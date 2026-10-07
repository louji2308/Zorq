import { useParams } from "react-router-dom";

export function RunRoute() {
  const params = useParams<{ id: string }>();
  return (
    <main>
      <h1>Zorq</h1>
      <p>Zorq — Phases 6–8 will build this screen (route /run/:id).</p>
      <p>Run id: {params.id ?? "(missing)"}</p>
    </main>
  );
}
