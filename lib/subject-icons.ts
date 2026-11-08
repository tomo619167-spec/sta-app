import { normalizeSubject } from "./model";
export const subjectIconKeys = [
  "math",
  "language",
  "history",
  "physics",
  "chemistry",
  "biology",
  "economics",
  "code",
  "general",
] as const;
export type SubjectIconKey = (typeof subjectIconKeys)[number];
export interface SubjectIconSetting {
  subjectId: string;
  icon: SubjectIconKey;
  source: "auto" | "manual";
  updatedAt: string;
}
export const subjectIconLabels: Record<SubjectIconKey, string> = {
  math: "数学",
  language: "言語",
  history: "歴史",
  physics: "原子",
  chemistry: "フラスコ",
  biology: "葉",
  economics: "グラフ",
  code: "コード",
  general: "ノート",
};
const rules: [SubjectIconKey, RegExp][] = [
  ["physics", /物理|力学|電磁気|相対性|量子|physics/],
  ["chemistry", /化学|chemistry/],
  ["biology", /生物|生命|遺伝|生態|biology/],
  ["economics", /経済|経営|金融|会計|財務|economics|finance/],
  ["code", /情報|プログラ|計算機|コンピュー|アルゴリズム|computer|programming/],
  [
    "math",
    /数学|算数|代数|幾何|微分|積分|微積|解析|確率|統計|数理|線形|三角関数|math|calculus|algebra/,
  ],
  [
    "language",
    /英語|英会話|英文|英検|外国語|国語|現代文|古文|漢文|言語|フランス語|中国語|ドイツ語|韓国語|スペイン語|english|toeic|toefl|ielts/,
  ],
  ["history", /世界史|日本史|歴史|地理|史学|東洋史|西洋史|history/],
];
export function inferSubjectIcon(name: string): SubjectIconKey {
  const normalized = normalizeSubject(name);
  return (
    rules.find(([, expression]) => expression.test(normalized))?.[0] ??
    "general"
  );
}
export function validateSubjectIcon(icon: SubjectIconKey) {
  if (!subjectIconKeys.includes(icon))
    throw new Error("アイコンを選び直してください。");
  return icon;
}
