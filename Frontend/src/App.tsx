import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useParams,
} from 'react-router-dom'
import { AppEntryPage } from './pages/app/AppEntryPage'
import { DashboardPage } from './pages/app/DashboardPage'
import { AgentBuilderPage } from './pages/app/AgentBuilderPage'
import { TaskNewPage } from './pages/app/TaskNewPage'
import { TaskWorkspacePage } from './pages/app/TaskWorkspacePage'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { WorkspaceAppRoute } from './routes/WorkspaceAppRoute'
import { ProtectedRoute } from './routes/ProtectedRoute'

function AppShell() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  )
}

/** Remount the builder khi chuyển /agents/new ↔ /agents/:id để form không tái sử dụng state. */
function AgentBuilderById() {
  const { agentId } = useParams()
  return <AgentBuilderPage key={agentId} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate replace to="/login" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<AppEntryPage />} />
          <Route path="w/:workspaceId" element={<WorkspaceAppRoute />}>
            <Route
              index
              element={<Navigate to="dashboard" replace />}
            />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route
              path="agents/new"
              element={<AgentBuilderPage key="new" />}
            />
            <Route path="agents/:agentId" element={<AgentBuilderById />} />
            <Route path="tasks/new" element={<TaskNewPage />} />
            <Route path="tasks/:taskId" element={<TaskWorkspacePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate replace to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}
