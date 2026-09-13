import { RoutinesSection } from './RoutinesSection'

/** S0 stub. S3 implements Pinned · Today · In progress here. Routines is S2's component. */
export function HomeView() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-3">
      <h1 className="text-lg font-semibold">Home</h1>
      <RoutinesSection />
    </div>
  )
}
