import type { FeedbackDocument } from "@/lib/learning-feedback";
export function FeedbackBody({ document }: { document: FeedbackDocument }) {
  const sections: [string, string[] | string | undefined][] =
    document.kind === "output"
      ? [
          ["正しく説明できた点", document.strengths],
          ["不足している重要事項", document.missing],
          ["誤解の可能性", document.misunderstandings],
          ["改善のヒント", document.advice],
        ]
      : document.version === 3
        ? [
            ["フィードバック", document.explanation],
            ["考えるヒント", document.hints],
            ["反例", document.counterexamples],
            ["別の視点", document.perspectives],
            ["本質的な特徴", document.features],
            ["具体例", document.examples],
            ["似た概念との違い", document.comparisons],
          ]
        : document.version === 2
          ? [
              ["問いへの説明", document.explanation],
              ["具体例", document.examples],
              ["比較", document.comparisons],
              ["誤解しやすい点", document.misunderstandings],
            ]
          : [
              ["仮説の検討", document.assessment],
              ["反例", document.counterexamples],
              ["別の視点", document.perspectives],
            ];
  return (
    <div className="feedback-body">
      <p className="roadmap-hint">AIの参考情報 · 自己評価とは別に保存</p>
      {[
        ...sections,
        ["次に考える問い", document.questions],
        ["不確実な点", document.uncertainty],
      ].map(([label, value]) => (
        <section key={label as string}>
          <h3>{label}</h3>
          {Array.isArray(value) ? (
            value.length ? (
              <ul>
                {value.map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ul>
            ) : (
              <p className="roadmap-hint">記載なし</p>
            )
          ) : (
            <p>{value}</p>
          )}
        </section>
      ))}
    </div>
  );
}
