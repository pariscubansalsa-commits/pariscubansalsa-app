import { Redirect } from "expo-router";

export default function NewEventRedirect() {
  return <Redirect href={"/organisateur/event/new" as any} />;
}
