#!/usr/bin/env python3
"""
Integrity Investigator - model training script.

Stages (run one at a time or all):
  prepare      merge / clean / balance / split the AI-vs-human CSV files (80/10/10)
  detector     fine-tune a transformer (default microsoft/deberta-v3-base) for AI vs human
  stylometric  gradient-boosted trees on stylometric features
  paraphrase   fine-tune a sentence-transformer on paraphrase pairs (MultipleNegativesRankingLoss)
  claims       fine-tune an NLI model for Supported / Partially supported / Not supported
  ensemble     Platt-scale the detector + stylometric scores and pick a safe threshold

Example (Kaggle / Colab GPU):
  pip install -r requirements.txt
  python train_integrity_models.py --stage prepare --data daigt_v2.csv ai_vs_human.csv
  python train_integrity_models.py --stage detector
  python train_integrity_models.py --stage stylometric
  python train_integrity_models.py --stage ensemble

Input CSV formats
  AI vs human : columns "text" (or "essay") and "label" (or "generated"); 1 = AI, 0 = human
  paraphrase  : columns "sentence1", "sentence2", "label" (1 = paraphrase)
  claims      : columns "claim", "evidence", "label" in {0: supported, 1: partial, 2: not_supported}
"""
import argparse
import json
import os
import re
import unicodedata

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split

SEED = 42
FUNCTION_WORDS = set(
    "the a an of to in and or but if then than that this these those is are was were be been being "
    "for with on at by from as it its they them their he she his her we our you your i not no".split()
)
AI_MARKERS = [
    "furthermore", "moreover", "in conclusion", "delve", "it is important to note", "overall",
    "in today's", "plays a crucial role", "a testament to", "navigate", "landscape", "tapestry",
]


# ---------------------------------------------------------------- data
def normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", str(text)).lower()
    return re.sub(r"\s+", " ", text).strip()


def read_ai_human(paths):
    frames = []
    for p in paths:
        df = pd.read_csv(p)
        text_col = next(c for c in ("text", "essay") if c in df.columns)
        label_col = next(c for c in ("label", "generated") if c in df.columns)
        frames.append(pd.DataFrame({"text": df[text_col], "label": df[label_col].astype(int)}))
    return pd.concat(frames, ignore_index=True)


def stage_prepare(args):
    df = read_ai_human(args.data)
    df["text"] = df["text"].map(normalise)
    df = df[df["text"].str.split().str.len() >= 20].drop_duplicates("text")
    n = df["label"].value_counts().min()  # balance human / AI
    df = pd.concat([g.sample(n, random_state=SEED) for _, g in df.groupby("label")])
    if args.sample:
        df = df.sample(min(args.sample, len(df)), random_state=SEED)
    train, rest = train_test_split(df, test_size=0.2, stratify=df["label"], random_state=SEED)
    val, test = train_test_split(rest, test_size=0.5, stratify=rest["label"], random_state=SEED)
    os.makedirs(args.out, exist_ok=True)
    for name, part in (("train", train), ("val", val), ("test", test)):
        part.to_csv(f"{args.out}/{name}.csv", index=False)
    print(f"train={len(train)} val={len(val)} test={len(test)}")


def load_splits(args):
    return [pd.read_csv(f"{args.out}/{n}.csv") for n in ("train", "val", "test")]


# ---------------------------------------------------------------- detector
def stage_detector(args):
    import torch
    from datasets import Dataset
    from transformers import (AutoModelForSequenceClassification, AutoTokenizer, Trainer,
                              TrainingArguments, DataCollatorWithPadding)

    train, val, test = load_splits(args)
    tok = AutoTokenizer.from_pretrained(args.detector_model)
    enc = lambda b: tok(b["text"], truncation=True, max_length=512)
    make = lambda d: Dataset.from_pandas(d).map(enc, batched=True).remove_columns(["text", "__index_level_0__"] if "__index_level_0__" in d.columns else ["text"])
    ds_train, ds_val, ds_test = make(train), make(val), make(test)
    model = AutoModelForSequenceClassification.from_pretrained(args.detector_model, num_labels=2)

    def metrics(p):
        probs = torch.softmax(torch.tensor(p.predictions), -1)[:, 1].numpy()
        pred = (probs > 0.5).astype(int)
        return {"accuracy": accuracy_score(p.label_ids, pred), "f1": f1_score(p.label_ids, pred),
                "roc_auc": roc_auc_score(p.label_ids, probs)}

    targs = TrainingArguments(
        output_dir=f"{args.out}/detector", num_train_epochs=3, learning_rate=2e-5,
        per_device_train_batch_size=8, per_device_eval_batch_size=16, weight_decay=0.01,
        fp16=torch.cuda.is_available(), eval_strategy="epoch", save_strategy="epoch",
        load_best_model_at_end=True, metric_for_best_model="f1", report_to="none", seed=SEED,
    )
    trainer = Trainer(model=model, args=targs, train_dataset=ds_train, eval_dataset=ds_val,
                      data_collator=DataCollatorWithPadding(tok), compute_metrics=metrics)
    trainer.train()
    print("TEST:", trainer.evaluate(ds_test))
    trainer.save_model(f"{args.out}/detector/best")
    tok.save_pretrained(f"{args.out}/detector/best")


# ---------------------------------------------------------------- stylometry
def stylometric_features(text: str) -> list:
    sents = [s for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    words = re.findall(r"[a-z']+", text.lower())
    lens = np.array([len(s.split()) for s in sents]) if sents else np.array([0])
    n = max(len(words), 1)
    low = text.lower()
    return [
        float(lens.mean()), float(lens.std()),
        float(lens.std() / (lens.mean() + 1e-9)),          # burstiness
        len(set(words)) / n,                                # type-token ratio
        sum(w in FUNCTION_WORDS for w in words) / n,        # function-word ratio
        100 * sum(low.count(m) for m in AI_MARKERS) / n,    # AI marker density /100 words
        1 - len(set(zip(words, words[1:]))) / max(len(words) - 1, 1),  # repetition
        float(np.mean([len(w) for w in words])) if words else 0.0,
        len(sents),
    ]


def stage_stylometric(args):
    train, val, test = load_splits(args)
    feats = lambda d: np.array([stylometric_features(t) for t in d["text"]])
    clf = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, random_state=SEED)
    clf.fit(feats(train), train["label"])
    p = clf.predict_proba(feats(test))[:, 1]
    print("TEST acc=%.4f f1=%.4f auc=%.4f" % (accuracy_score(test["label"], p > 0.5),
                                              f1_score(test["label"], p > 0.5), roc_auc_score(test["label"], p)))
    joblib.dump(clf, f"{args.out}/stylometric.joblib")


# ---------------------------------------------------------------- paraphrase / similarity
def stage_paraphrase(args):
    from sentence_transformers import InputExample, SentenceTransformer, losses
    from torch.utils.data import DataLoader

    df = pd.read_csv(args.pairs)
    df = df[df["label"] == 1].dropna(subset=["sentence1", "sentence2"])
    examples = [InputExample(texts=[a, b]) for a, b in zip(df["sentence1"], df["sentence2"])]
    model = SentenceTransformer(args.sim_model)
    loader = DataLoader(examples, shuffle=True, batch_size=32)
    loss = losses.MultipleNegativesRankingLoss(model)
    model.fit(train_objectives=[(loader, loss)], epochs=1, warmup_steps=100, show_progress_bar=True)
    model.save(f"{args.out}/paraphrase")


# ---------------------------------------------------------------- claim verification (NLI)
def stage_claims(args):
    import torch
    from datasets import Dataset
    from transformers import (AutoModelForSequenceClassification, AutoTokenizer, Trainer,
                              TrainingArguments, DataCollatorWithPadding)

    df = pd.read_csv(args.claims_csv).dropna()
    tr, ev = train_test_split(df, test_size=0.1, stratify=df["label"], random_state=SEED)
    tok = AutoTokenizer.from_pretrained(args.nli_model)
    enc = lambda b: tok(b["evidence"], b["claim"], truncation=True, max_length=256)
    make = lambda d: Dataset.from_pandas(d.reset_index(drop=True)).map(enc, batched=True, remove_columns=["claim", "evidence"])
    model = AutoModelForSequenceClassification.from_pretrained(args.nli_model, num_labels=3, ignore_mismatched_sizes=True)
    metrics = lambda p: {"accuracy": accuracy_score(p.label_ids, p.predictions.argmax(-1))}
    targs = TrainingArguments(output_dir=f"{args.out}/claims", num_train_epochs=2, learning_rate=1e-5,
                              per_device_train_batch_size=8, fp16=torch.cuda.is_available(),
                              eval_strategy="epoch", save_strategy="no", report_to="none", seed=SEED)
    trainer = Trainer(model=model, args=targs, train_dataset=make(tr), eval_dataset=make(ev),
                      data_collator=DataCollatorWithPadding(tok), compute_metrics=metrics)
    trainer.train()
    trainer.save_model(f"{args.out}/claims/best")
    tok.save_pretrained(f"{args.out}/claims/best")


# ---------------------------------------------------------------- ensemble + calibration
def stage_ensemble(args):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    _, val, _ = load_splits(args)
    tok = AutoTokenizer.from_pretrained(f"{args.out}/detector/best")
    det = AutoModelForSequenceClassification.from_pretrained(f"{args.out}/detector/best").eval()
    sty = joblib.load(f"{args.out}/stylometric.joblib")

    p_det = []
    for i in range(0, len(val), 16):
        batch = tok(list(val["text"][i:i + 16]), truncation=True, max_length=512, padding=True, return_tensors="pt")
        with torch.no_grad():
            p_det += torch.softmax(det(**batch).logits, -1)[:, 1].tolist()
    p_det = np.clip(np.array(p_det), 1e-4, 1 - 1e-4)
    p_sty = np.clip(sty.predict_proba(np.array([stylometric_features(t) for t in val["text"]]))[:, 1], 1e-4, 1 - 1e-4)
    logit = lambda p: np.log(p / (1 - p))
    X, y = np.column_stack([logit(p_det), logit(p_sty)]), val["label"].values

    platt = LogisticRegression().fit(X, y)  # Platt scaling / weight learning
    p = platt.predict_proba(X)[:, 1]
    best_t, best_f1 = 0.5, 0.0
    for t in np.linspace(0.2, 0.95, 76):    # maximise macro-F1 with <= 2% false positives on human text
        pred = p > t
        fpr = float(((pred == 1) & (y == 0)).sum() / max((y == 0).sum(), 1))
        f1 = f1_score(y, pred, average="macro")
        if fpr <= 0.02 and f1 > best_f1:
            best_t, best_f1 = float(t), float(f1)
    out = {"weights": platt.coef_[0].tolist(), "bias": float(platt.intercept_[0]), "threshold": best_t, "val_macro_f1": best_f1}
    json.dump(out, open(f"{args.out}/ensemble.json", "w"), indent=2)
    print(out)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stage", required=True, choices=["prepare", "detector", "stylometric", "paraphrase", "claims", "ensemble", "all"])
    ap.add_argument("--data", nargs="+", help="AI-vs-human CSV files (for --stage prepare)")
    ap.add_argument("--pairs", default="paraphrase_pairs.csv")
    ap.add_argument("--claims-csv", dest="claims_csv", default="claims.csv")
    ap.add_argument("--out", default="artifacts")
    ap.add_argument("--sample", type=int, default=0, help="use only N rows (quick test run)")
    ap.add_argument("--detector-model", default="microsoft/deberta-v3-base")
    ap.add_argument("--sim-model", default="sentence-transformers/all-mpnet-base-v2")
    ap.add_argument("--nli-model", default="roberta-large-mnli")
    args = ap.parse_args()
    stages = {"prepare": stage_prepare, "detector": stage_detector, "stylometric": stage_stylometric,
              "paraphrase": stage_paraphrase, "claims": stage_claims, "ensemble": stage_ensemble}
    for name in (stages if args.stage == "all" else [args.stage]):
        print(f"=== {name} ===")
        stages[name](args)


if __name__ == "__main__":
    main()
