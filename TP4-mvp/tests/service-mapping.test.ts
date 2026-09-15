import { toProfessionalService } from "../front-end/src/navigation/serviceMapping";
import type { ClientWorkService } from "../front-end/src/pages";

function makeService(
  status: ClientWorkService["status"],
): ClientWorkService {
  return {
    id: "contract-1",
    title: "Reforma da cozinha",
    dateLabel: "Início:",
    dateValue: "10/09/2026",
    professionalName: "João da Silva",
    professionalRole: "Pedreiro",
    avatarUri: "",
    conversationId: "conversation-1",
    unreadMessages: 2,
    status,
    statusOptions: [],
    hasReview: false,
    description: "Troca do revestimento",
    categoryLabel: "Alvenaria",
    imageUrls: ["https://example.com/image.jpg"],
    price: "R$ 1.500,00",
    time: "08:00",
    deadline: "5 dias",
    address: "Rua das Flores, 10",
  };
}

describe("toProfessionalService", () => {
  it.each([
    ["em_andamento", "inProgress"],
    ["aguardando_aprovacao", "pending"],
    ["concluido", "completed"],
    ["reabrir_servico", "inProgress"],
  ] as const)("maps %s to %s", (status, expectedStatus) => {
    const mapped = toProfessionalService(makeService(status));

    expect(mapped.status).toBe(expectedStatus);
  });

  it("preserves service data and applies safe display defaults", () => {
    const service = makeService("concluido");
    const mapped = toProfessionalService({
      ...service,
      price: undefined,
      time: undefined,
      deadline: undefined,
      unreadMessages: 0,
    });

    expect(mapped).toMatchObject({
      title: service.title,
      order: service.id,
      customer: service.professionalName,
      date: service.dateValue,
      address: service.address,
      category: service.categoryLabel,
      description: service.description,
      imageUrls: service.imageUrls,
      hasReview: service.hasReview,
      price: "A combinar",
      time: "A combinar",
      deadline: "A combinar",
      messageCount: undefined,
    });
  });
});
