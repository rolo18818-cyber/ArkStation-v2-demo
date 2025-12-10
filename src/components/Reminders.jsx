import ServiceReminders from './ServiceReminders'

export default function Reminders({ theme, currentUser, userRole }) {
  return <ServiceReminders theme={theme} currentUser={currentUser} userRole={userRole} />
}
