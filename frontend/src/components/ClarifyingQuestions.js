import { useState } from "react";
import { HelpCircle } from "lucide-react";

export const ClarifyingQuestions = ({ t, questions, onSubmit, onSkip }) => {
  const [answers, setAnswers] = useState({});
  if (!questions?.length) return null;

  return (
    <section
      data-testid="clarifying-questions"
      className="border border-[#38BDF8]/30 bg-[#38BDF8]/[0.04] rounded-xl p-4 pz-rise"
    >
      <h3 className="text-sm font-semibold text-[#F0F6FC] flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-[#38BDF8]" />
        {t.clarifying}
      </h3>
      <p className="text-xs text-[#8B949E] mt-1 mb-3">{t.clarifyingHint}</p>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={i}>
            <p className="text-xs text-[#F0F6FC] mb-1.5">{i + 1}. {q}</p>
            <input
              data-testid={`clarifying-answer-${i}`}
              className="pz-field px-3 py-2 text-sm w-full"
              placeholder={t.answerPlaceholder}
              value={answers[i] || ""}
              onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          data-testid="submit-answers-button"
          onClick={() => onSubmit(questions.map((q, i) => ({ q, a: answers[i] || "" })).filter((x) => x.a.trim()))}
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#84CC16] text-[#0D1117] hover:bg-[#A3E635] transition-colors"
        >
          {t.submitAnswers}
        </button>
        <button
          data-testid="skip-questions-button"
          onClick={onSkip}
          className="text-xs font-medium px-4 py-2 rounded-lg border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] transition-colors"
        >
          {t.skipQuestions}
        </button>
      </div>
    </section>
  );
};
