import PointOfSale from './PointOfSale'

export default function POS({ theme, currentUser, userRole }) {
  return <PointOfSale theme={theme} currentUser={currentUser} userRole={userRole} />
}
