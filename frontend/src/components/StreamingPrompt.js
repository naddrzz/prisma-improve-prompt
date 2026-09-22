import { useEffect, useRef } from "react";

export const StreamingPrompt = ({ text }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <div
      data-testid="streaming-prompt"
      ref={ref}
      className="pz-scroll max-h-[420px] overflow-auto rounded-xl border border-[#84CC16]/35 bg-[#0D1117] p-4"
    >
      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[#F0F6FC] m-0">
        {text}
        <span className="inline-block w-[7px] h-[15px] translate-y-[2px] ml-0.5 bg-[#84CC16] animate-pulse" />
      </pre>
    </div>
  );
};
