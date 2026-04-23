"""
Fine-tune T5-small on multi-task text transformations for the CoResearch AI assistant.

Tasks trained:
  - summarize   : condense a paragraph into key points
  - expand      : elaborate and add detail to a passage
  - formalize   : rewrite in formal / academic English
  - bulletize   : convert prose into bullet-point list
  - improve     : fix grammar, clarity, and conciseness

Run:
    python train.py

The fine-tuned model is saved to ./model/
"""

import os
import json
import random
from pathlib import Path

import torch
from datasets import load_dataset, Dataset
from transformers import (
    T5ForConditionalGeneration,
    T5Tokenizer,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
    DataCollatorForSeq2Seq,
    EarlyStoppingCallback,
)

# ── Configuration ──────────────────────────────────────────────────────────────
MODEL_NAME   = "t5-small"          # ~60 MB — swap to "t5-base" for more quality
OUTPUT_DIR   = Path("./model")
MAX_INPUT    = 512
MAX_TARGET   = 256
BATCH_SIZE   = 8                   # lower to 4 if you run out of RAM
EPOCHS       = 3
LR           = 3e-4
SEED         = 42

random.seed(SEED)
torch.manual_seed(SEED)


# ── Synthetic data for tasks with no standard public dataset ───────────────────
SYNTHETIC_EXPAND = [
    {
        "input": "expand: Climate change affects sea levels.",
        "target": "Climate change is causing a measurable rise in global sea levels, primarily driven by the thermal expansion of warming ocean waters and the accelerated melting of polar ice caps and glaciers. These rising seas threaten coastal communities, erode shorelines, and increase the frequency and severity of storm surges.",
    },
    {
        "input": "expand: Machine learning requires large datasets.",
        "target": "Machine learning algorithms, particularly deep neural networks, typically require access to large, high-quality datasets in order to generalise effectively to unseen examples. Without sufficient training data, models are prone to overfitting — learning the idiosyncrasies of the training set rather than the underlying patterns — which severely limits their real-world performance.",
    },
    {
        "input": "expand: Regular exercise improves mental health.",
        "target": "Engaging in regular physical exercise has been consistently shown to produce significant improvements in mental health outcomes. Exercise stimulates the release of endorphins and neurotransmitters such as serotonin and dopamine, which elevate mood and reduce symptoms of anxiety and depression. Additionally, sustained physical activity promotes neuroplasticity and can help buffer against the physiological effects of chronic stress.",
    },
    {
        "input": "expand: The study found no significant results.",
        "target": "The study found no statistically significant results, meaning the observed differences between the experimental and control groups could not be distinguished from random variation at the chosen significance threshold (p > 0.05). This null result does not necessarily imply the absence of a real effect; rather, it may reflect insufficient statistical power due to a small sample size, high measurement variability, or an effect size smaller than the study was designed to detect.",
    },
    {
        "input": "expand: Renewable energy is growing rapidly.",
        "target": "The renewable energy sector is experiencing unprecedented growth globally, driven by dramatic reductions in the cost of solar photovoltaic panels and wind turbines, supportive government policy frameworks, and increasing corporate commitments to net-zero emissions. Solar capacity alone has expanded more than tenfold over the past decade, and projections suggest that renewables will constitute the majority of new electricity generation capacity installed worldwide over the next several years.",
    },
    {
        "input": "expand: Data privacy is a growing concern.",
        "target": "Data privacy has emerged as one of the defining concerns of the digital age as individuals, organisations, and governments grapple with the implications of pervasive data collection and analysis. The aggregation of personal information by technology companies, coupled with high-profile data breaches and revelations about surveillance practices, has eroded public trust and prompted regulators in many jurisdictions to introduce comprehensive data protection legislation, including the European Union's General Data Protection Regulation (GDPR).",
    },
    {
        "input": "expand: The algorithm converges quickly.",
        "target": "The algorithm demonstrates rapid convergence behaviour, consistently reaching a near-optimal solution within a small number of iterations even for large-scale problem instances. This efficiency is attributable to the adaptive step-size mechanism incorporated into the update rule, which allows the algorithm to take larger steps in flat regions of the loss landscape and smaller, more precise steps near local minima, thereby avoiding oscillation and unnecessary computation.",
    },
    {
        "input": "expand: Education inequality persists globally.",
        "target": "Educational inequality remains a deeply entrenched global challenge, with vast disparities in access to quality schooling driven by socioeconomic status, geographic location, gender, and ethnicity. Children in low-income households and rural communities frequently attend under-resourced schools with overcrowded classrooms, undertrained teachers, and inadequate infrastructure. These disparities compound over time, limiting social mobility and perpetuating cycles of poverty across generations.",
    },
]

SYNTHETIC_FORMALIZE = [
    {"input": "formalize: We found that the method works really well.",
     "target": "The results demonstrate that the proposed method performs with a high degree of efficacy."},
    {"input": "formalize: The data shows something interesting about how people behave.",
     "target": "The data reveals a noteworthy pattern regarding human behavioural tendencies."},
    {"input": "formalize: This is a big problem that needs to be fixed.",
     "target": "This issue represents a significant challenge that requires immediate remediation."},
    {"input": "formalize: We used a bunch of different tools to collect the data.",
     "target": "A variety of instruments and methodologies were employed to facilitate data collection."},
    {"input": "formalize: The experiment didn't go as planned.",
     "target": "The experimental outcomes deviated from the anticipated results."},
    {"input": "formalize: Lots of people use social media every day.",
     "target": "A substantial proportion of the population engages with social media platforms on a daily basis."},
    {"input": "formalize: We think this is because of the environment.",
     "target": "It is hypothesised that this phenomenon is attributable to environmental factors."},
    {"input": "formalize: The results are pretty consistent across all tests.",
     "target": "The findings demonstrate a high degree of consistency across all experimental conditions."},
    {"input": "formalize: This shows that our approach is better than the old one.",
     "target": "These results indicate that the proposed approach yields superior performance compared with the existing baseline."},
    {"input": "formalize: We need more research to understand this fully.",
     "target": "Further empirical investigation is required to develop a comprehensive understanding of this phenomenon."},
]

SYNTHETIC_BULLETIZE = [
    {
        "input": "bulletize: The study examined three main factors: temperature, pressure, and humidity. Each factor was measured at hourly intervals over a period of 30 days.",
        "target": "- Examined three main factors: temperature, pressure, and humidity\n- Each factor measured at hourly intervals\n- Study period: 30 days",
    },
    {
        "input": "bulletize: Participants were required to complete a consent form, attend an introductory session, and submit weekly reports throughout the duration of the study.",
        "target": "- Complete a consent form\n- Attend an introductory session\n- Submit weekly reports throughout the study",
    },
    {
        "input": "bulletize: The benefits of the intervention include reduced costs, improved efficiency, and greater user satisfaction. However, implementation requires significant upfront investment and staff training.",
        "target": "Benefits:\n- Reduced costs\n- Improved efficiency\n- Greater user satisfaction\n\nConsiderations:\n- Significant upfront investment required\n- Staff training necessary",
    },
    {
        "input": "bulletize: The research contributes to the literature in several ways. First, it provides a novel theoretical framework. Second, it offers empirical evidence from an underexplored context. Third, it identifies practical implications for policymakers.",
        "target": "- Provides a novel theoretical framework\n- Offers empirical evidence from an underexplored context\n- Identifies practical implications for policymakers",
    },
]

SYNTHETIC_IMPROVE = [
    {"input": "improve: the results shows that there is a correlation between the two variable.",
     "target": "The results show that there is a correlation between the two variables."},
    {"input": "improve: Many researcher have study this topic extensively.",
     "target": "Many researchers have studied this topic extensively."},
    {"input": "improve: The study was very very important because it showed very significant findings.",
     "target": "The study was significant because it yielded important findings."},
    {"input": "improve: We can see that the data is showing an upward trend in the graph.",
     "target": "The data shows an upward trend."},
    {"input": "improve: This paper discusses about the impact of social media on young peoples mental health.",
     "target": "This paper examines the impact of social media on young people's mental health."},
    {"input": "improve: The experiment was conducted in a lab environment under controlled conditions by researchers.",
     "target": "Researchers conducted the experiment under controlled laboratory conditions."},
    {"input": "improve: Due to the fact that the sample size was small, the results may not be generalizable.",
     "target": "Because the sample size was small, the results may not generalise broadly."},
    {"input": "improve: It should be noted that there are limitations to this study that needs to be acknowledged.",
     "target": "This study has limitations that should be acknowledged."},
]


def build_synthetic_dataset():
    """Combine all synthetic examples into a list of {input, target} dicts."""
    rows = []
    rows.extend(SYNTHETIC_EXPAND)
    rows.extend(SYNTHETIC_FORMALIZE)
    rows.extend(SYNTHETIC_BULLETIZE)
    rows.extend(SYNTHETIC_IMPROVE)
    return rows


def load_summarization_data(n_train: int = 4000, n_val: int = 400):
    """
    Download CNN/DailyMail and return (train_rows, val_rows) in T5 format.
    Falls back to XSum if CNN/DM is unavailable.
    """
    print("Downloading summarisation dataset (CNN/DailyMail) …")
    try:
        raw = load_dataset("cnn_dailymail", "3.0.0", trust_remote_code=True)
        article_col, summary_col = "article", "highlights"
    except Exception:
        print("CNN/DailyMail unavailable, falling back to XSum …")
        raw = load_dataset("xsum", trust_remote_code=True)
        article_col, summary_col = "document", "summary"

    def convert(examples):
        return {
            "input":  [f"summarize: {a}" for a in examples[article_col]],
            "target": [s for s in examples[summary_col]],
        }

    train_data = raw["train"].shuffle(seed=SEED).select(range(n_train))
    val_data   = raw["validation"].shuffle(seed=SEED).select(range(n_val))

    train_rows = [{"input": inp, "target": tgt}
                  for inp, tgt in zip(convert(train_data)["input"], convert(train_data)["target"])]
    val_rows   = [{"input": inp, "target": tgt}
                  for inp, tgt in zip(convert(val_data)["input"], convert(val_data)["target"])]

    return train_rows, val_rows


def tokenize(examples, tokenizer):
    model_inputs = tokenizer(
        examples["input"],
        max_length=MAX_INPUT,
        truncation=True,
        padding=False,
    )
    with tokenizer.as_target_tokenizer():
        labels = tokenizer(
            examples["target"],
            max_length=MAX_TARGET,
            truncation=True,
            padding=False,
        )
    model_inputs["labels"] = labels["input_ids"]
    return model_inputs


def main():
    print(f"Loading tokenizer and model: {MODEL_NAME}")
    tokenizer = T5Tokenizer.from_pretrained(MODEL_NAME)
    model     = T5ForConditionalGeneration.from_pretrained(MODEL_NAME)

    # ── Build datasets ──────────────────────────────────────────────────────────
    print("Building training dataset …")
    sum_train, sum_val = load_summarization_data()
    synthetic          = build_synthetic_dataset()

    # Oversample synthetic data so it balances the larger summarisation set
    oversampled_synthetic = synthetic * max(1, len(sum_train) // max(len(synthetic), 1))
    random.shuffle(oversampled_synthetic)

    train_rows = sum_train + oversampled_synthetic[:len(sum_train)]
    val_rows   = sum_val   + synthetic  # all synthetic examples in val too

    random.shuffle(train_rows)
    random.shuffle(val_rows)

    print(f"  Train examples : {len(train_rows)}")
    print(f"  Val   examples : {len(val_rows)}")

    train_ds = Dataset.from_list(train_rows)
    val_ds   = Dataset.from_list(val_rows)

    train_ds = train_ds.map(lambda ex: tokenize(ex, tokenizer), batched=True,
                            remove_columns=["input", "target"])
    val_ds   = val_ds.map(lambda ex: tokenize(ex, tokenizer), batched=True,
                          remove_columns=["input", "target"])

    # ── Training ────────────────────────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    args = Seq2SeqTrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        learning_rate=LR,
        weight_decay=0.01,
        warmup_ratio=0.05,
        predict_with_generate=True,
        generation_max_length=MAX_TARGET,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        logging_steps=50,
        fp16=torch.cuda.is_available(),
        seed=SEED,
        report_to="none",
    )

    collator = DataCollatorForSeq2Seq(tokenizer, model=model, padding=True)

    trainer = Seq2SeqTrainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        tokenizer=tokenizer,
        data_collator=collator,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    print("Starting training …")
    trainer.train()

    print(f"Saving model to {OUTPUT_DIR} …")
    trainer.save_model(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))

    # Save a simple metadata file the server can read
    meta = {
        "base_model": MODEL_NAME,
        "tasks": ["summarize", "expand", "formalize", "bulletize", "improve"],
        "max_input_tokens": MAX_INPUT,
        "max_target_tokens": MAX_TARGET,
    }
    (OUTPUT_DIR / "meta.json").write_text(json.dumps(meta, indent=2))

    print("\nTraining complete. Run  python serve.py  to start the inference server.")


if __name__ == "__main__":
    main()
