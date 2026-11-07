import { MySupportTicketsScreen, SupportDashboardScreen, SupportTicketScreen } from "../pages/suporte/SupportScreens";
import type { SupportScreen } from "./types";
import type { AppNavigation } from "./useAppNavigation";

export function SupportNavigator({ screen, navigation }: { screen: SupportScreen; navigation: AppNavigation }) {
  const openTicket = (id: string) => { navigation.setSelectedSupportTicketId(id); navigation.setSupportTicketReturnScreen(screen === "mySupportTickets" ? "mySupportTickets" : "supportDashboard"); navigation.setScreen("supportTicket"); };
  if (screen === "supportDashboard") return <SupportDashboardScreen onOpenTicket={openTicket} onProfile={() => navigation.openAccountProfile("supportDashboard")} onSignOut={() => { void navigation.signOut(); }} />;
  if (screen === "mySupportTickets") return <MySupportTicketsScreen onOpenTicket={openTicket} onBack={() => navigation.setScreen("accountProfile")} />;
  if (!navigation.selectedSupportTicketId) return null;
  return <SupportTicketScreen ticketId={navigation.selectedSupportTicketId} isAgent={navigation.authUser?.role === "SUPORTE"} onBack={() => navigation.setScreen(navigation.supportTicketReturnScreen)} />;
}
