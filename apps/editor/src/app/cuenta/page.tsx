import { AccountPage } from "@/account/AccountPage.tsx";
import es from "@/locales/es.json" with { type: "json" };

export const metadata = { title: es["account.page.title"] };

export default function Page() {
  return <AccountPage />;
}
