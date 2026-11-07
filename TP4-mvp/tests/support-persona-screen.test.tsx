import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { MySupportTicketsScreen, SupportDashboardScreen, SupportTicketScreen } from "../front-end/src/pages/suporte/SupportScreens";
import { api, type SupportTicketDetail } from "../front-end/src/services/api";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("expo-audio", () => ({ RecordingPresets: { HIGH_QUALITY: {} }, useAudioRecorder: jest.fn(() => ({})), requestRecordingPermissionsAsync: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("../front-end/src/services/image-upload", () => ({ pickAndUploadImage: jest.fn() }));

const detail: SupportTicketDetail = {
  id: "ticket-a", userId: "client-a", subject: "Problema no cadastro", message: "Não consigo concluir meu cadastro.",
  status: "OPEN", createdAt: "2026-11-01T12:00:00.000Z", updatedAt: "2026-11-01T12:00:00.000Z",
  user: { id: "client-a", name: "Cliente Ana", email: "ana@example.com", phone: "92999999999", role: "CLIENTE" },
  messages: [], auditLogs: [],
};

afterEach(() => jest.restoreAllMocks());

it("mostra a fila ao suporte e abre um chamado", async () => {
  jest.spyOn(api, "supportQueue").mockResolvedValue({ items: [detail], total: 1, page: 1, limit: 20 });
  const onOpenTicket = jest.fn();
  const screen = render(<SupportDashboardScreen onOpenTicket={onOpenTicket} onProfile={jest.fn()} onSignOut={jest.fn()} />);
  fireEvent.press(await screen.findByLabelText("Abrir chamado Problema no cadastro"));
  expect(onOpenTicket).toHaveBeenCalledWith("ticket-a");
  fireEvent.press(screen.getByLabelText("Em atendimento"));
  await waitFor(() => expect(api.supportQueue).toHaveBeenLastCalledWith({ status: "IN_REVIEW", page: 1, limit: 20 }));
});

it("permite ao usuário criar um chamado e abrir o histórico", async () => {
  jest.spyOn(api, "mySupportTickets").mockResolvedValue([detail]);
  jest.spyOn(api, "createSupportTicket").mockResolvedValue(detail);
  const onOpenTicket = jest.fn();
  const screen = render(<MySupportTicketsScreen onOpenTicket={onOpenTicket} onBack={jest.fn()} />);
  expect(await screen.findByLabelText("Abrir chamado Problema no cadastro")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Assunto do chamado"), "Novo problema");
  fireEvent.changeText(screen.getByLabelText("Descrição do chamado"), "Preciso de ajuda com meu pedido.");
  fireEvent.press(screen.getByLabelText("Criar chamado"));
  await waitFor(() => expect(api.createSupportTicket).toHaveBeenCalledWith({ subject: "Novo problema", message: "Preciso de ajuda com meu pedido." }));
  expect(onOpenTicket).toHaveBeenCalledWith("ticket-a");
});

it("envia texto e atualiza o histórico no detalhe do chamado", async () => {
  jest.spyOn(api, "supportTicket").mockResolvedValue(detail);
  const send = jest.spyOn(api, "sendSupportMessage").mockResolvedValue({ id: "message-a" } as never);
  const screen = render(<SupportTicketScreen ticketId="ticket-a" isAgent onBack={jest.fn()} />);
  expect(await screen.findByText("Não consigo concluir meu cadastro.")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Mensagem para suporte"), "Vou verificar o problema.");
  fireEvent.press(screen.getByLabelText("Enviar mensagem"));
  await waitFor(() => expect(send).toHaveBeenCalledWith("ticket-a", { type: "TEXT", text: "Vou verificar o problema." }));
  expect(api.supportTicket).toHaveBeenCalledTimes(2);
});
