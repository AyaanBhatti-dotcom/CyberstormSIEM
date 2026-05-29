import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DataConnectors } from './pages/DataConnectors';
import { Operations } from './pages/Operations';
import { Configure, Incidents, Search } from './pages/PlaceholderPages';
import { RedTerminal } from './pages/RedTerminal';
import { TeamPage } from './pages/TeamPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Fullscreen — no sidebar */}
        <Route path="terminal" element={<RedTerminal />} />

        <Route element={<Layout />}>
          <Route index element={<Operations />} />
          <Route path="red" element={<TeamPage team="red" />} />
          <Route path="blue" element={<TeamPage team="blue" />} />
          <Route path="target" element={<TeamPage team="target" />} />
          <Route path="connectors" element={<DataConnectors />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="search" element={<Search />} />
          <Route path="configure" element={<Configure />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
