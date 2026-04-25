import { useParams } from 'react-router-dom'
import { WorkspaceAppLayout } from '../layouts/WorkspaceAppLayout'

/**
 * Mỗi lần đổi `workspaceId` thì remount layout (trạng thái sidebar reset sạch).
 */
export function WorkspaceAppRoute() {
  const { workspaceId } = useParams()
  return <WorkspaceAppLayout key={workspaceId} />
}
