import { Route, Routes } from "react-router-dom";
import { BlueprintRoute } from "./routes/BlueprintRoute";
import { HomeRoute } from "./routes/HomeRoute";
import { MethodRoute } from "./routes/MethodRoute";
import { RunRoute } from "./routes/RunRoute";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/run/:id" element={<RunRoute />} />
      <Route path="/run/:id/blueprint" element={<BlueprintRoute />} />
      <Route path="/method" element={<MethodRoute />} />
    </Routes>
  );
}
