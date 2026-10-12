import type { S3NodeSheet } from "./s3Model.js";

export interface NodeSheetProps {
  sheet: S3NodeSheet;
  onReplace?: (memberId: string) => void;
}

export function NodeSheet({ sheet, onReplace }: NodeSheetProps) {
  return (
    <div className="s3-sheet">
      <p className="s3-sheet-role">{sheet.role ?? "Unassigned"}</p>
      <h3 className="s3-sheet-name">{sheet.name}</h3>
      {sheet.evidenceState !== null && (
        <p className="s3-sheet-state">Evidence: {sheet.evidenceState}</p>
      )}
      {sheet.exemplars.length > 0 && (
        <>
          <p className="s3-sheet-heading">Exemplar places</p>
          <ul className="s3-sheet-list">
            {sheet.exemplars.map((exemplar) => (
              <li key={exemplar.id} className="s3-sheet-item">
                {exemplar.name}
              </li>
            ))}
          </ul>
        </>
      )}
      {sheet.provenance.length > 0 && (
        <>
          <p className="s3-sheet-heading">Path</p>
          <ol className="s3-sheet-provenance">
            {sheet.provenance.map((step) => (
              <li key={step.label} className="s3-sheet-step">
                <span className="s3-sheet-step-label">{step.label}</span>
                <span className="s3-sheet-step-value">{step.value}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {sheet.exemplars.length === 0 && sheet.provenance.length === 0 && (
        <p className="s3-sheet-empty">
          No pool record is available for this component, so nothing is shown as evidence.
        </p>
      )}
      {onReplace !== undefined && (
        <button type="button" className="s1-tertiary" onClick={() => onReplace(sheet.id)}>
          Replace
        </button>
      )}
    </div>
  );
}
