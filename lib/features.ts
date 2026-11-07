import { Map, PenLine, Timer, BookOpen, Lightbulb } from "lucide-react";
export const features = [
  {
    slug: "roadmap",
    name: "学習ロードマップ",
    label: "学びの道すじを、ひとつずつ。",
    description:
      "理解したいことを並べ、到達度を確かめるロードマップ。外部AIで作ったJSONの取り込みにも対応する予定です。",
    phase: 2,
    icon: Map,
  },
  {
    slug: "output",
    name: "アウトプット",
    label: "自分の言葉で、説明する。",
    description:
      "学んだ内容を自分の言葉でまとめ、完成度と一緒に記録します。外部AI用のプロンプトコピーにも対応する予定です。",
    phase: 3,
    icon: PenLine,
  },
  {
    slug: "pomodoro",
    name: "ポモドーロタイマー",
    label: "目の前の学びに、集中する。",
    description:
      "集中と休憩のリズムをつくり、テーマごとに集中時間を記録するタイマーです。",
    phase: 4,
    icon: Timer,
  },
  {
    slug: "past-exams",
    name: "過去問モード",
    label: "知識を使って、確かめる。",
    description:
      "解いた問題と正誤を記録し、振り返りたい問題を残せるようにする予定です。",
    phase: 4,
    icon: BookOpen,
  },
  {
    slug: "deepen",
    name: "理解を深める",
    label: "ひとつの「なぜ」から、深く。",
    description:
      "疑問と仮説を整理し、外部AIと対話するためのプロンプトをコピー。対話から得た学びを記録する予定です。",
    phase: 3,
    icon: Lightbulb,
  },
] as const;
