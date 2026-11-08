"use client";
import { BookOpen, CheckSquare2, FilePenLine } from "lucide-react";
import { summarizeStudy } from "@/lib/study-summary";
import { useStudy } from "@/components/study/provider";
import { MasterySegments } from "@/components/study/mastery-segments";
export function StudySummary() {
  const { themes, items, records, masteryHistory } = useStudy();
  const value = summarizeStudy(themes, items, records, masteryHistory);
  return (
    <section className="trace-summary" aria-label="学習の軌跡">
      <h2>学習の軌跡</h2>
      <div className="summary-content">
        <div className="summary-total">
          <strong>{value[4]}</strong>
          <span>/ {value.total} 項目</span>
          <small>定着した</small>
        </div>
        <dl className="summary-metrics">
          <div>
            <dt>
              <BookOpen />
              <span>学習テーマ</span>
            </dt>
            <dd>{value.themeCount}</dd>
          </div>
          <div>
            <dt>
              <CheckSquare2 />
              <span>説明できる</span>
            </dt>
            <dd>{value[3]}</dd>
          </div>
          <div>
            <dt>
              <FilePenLine />
              <span>思考の記録</span>
            </dt>
            <dd>{value.recordCount}</dd>
          </div>
        </dl>
      </div>
      <MasterySegments counts={value} label="すべての学習項目" compact />
    </section>
  );
}
