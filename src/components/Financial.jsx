import FinancialManagement from './FinancialManagement'

export default function Financial({ theme, currentUser, userRole }) {
  return <FinancialManagement theme={theme} currentUser={currentUser} userRole={userRole} />
}
