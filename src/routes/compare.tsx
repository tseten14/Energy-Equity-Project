/** Keep previously shared Compare links working after the overview moves to /. */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/compare")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
