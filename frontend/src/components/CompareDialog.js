import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const CompareDialog = ({ t, open, onOpenChange, original, refined }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      data-testid="compare-dialog"
      className="max-w-5xl bg-[#161B22] border-[#30363D] text-[#F0F6FC]"
    >
      <DialogHeader>
        <DialogTitle className="text-base font-semibold">{t.compareTitle}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-auto pz-scroll">
        <div>
          <p className="text-[10px] font-mono uppercase text-[#6E7681] mb-2">{t.original}</p>
          <pre
            data-testid="compare-original"
            className="text-xs whitespace-pre-wrap bg-[#0D1117] border border-[#30363D] rounded-lg p-3 text-[#8B949E] leading-relaxed"
          >{original || "—"}</pre>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase text-[#84CC16] mb-2">{t.refined}</p>
          <pre
            data-testid="compare-refined"
            className="text-xs whitespace-pre-wrap bg-[#0D1117] border border-[#84CC16]/30 rounded-lg p-3 text-[#F0F6FC] leading-relaxed"
          >{refined || "—"}</pre>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
