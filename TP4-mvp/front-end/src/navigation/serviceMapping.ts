import type { ProfessionalService, ServiceStatus } from "../components/profissional/types";
import type { ClientWorkService } from "../pages";

const clientStatusToProfessionalStatus: Record<
  ClientWorkService["status"],
  ServiceStatus
> = {
  em_andamento: "inProgress",
  aguardando_aprovacao: "pending",
  concluido: "completed",
  reabrir_servico: "inProgress",
};

export function toProfessionalService(
  service: ClientWorkService,
): ProfessionalService {
  return {
    title: service.title,
    status: clientStatusToProfessionalStatus[service.status],
    order: service.id,
    customer: service.professionalName,
    price: service.price ?? "A combinar",
    date: service.dateValue,
    time: service.time ?? "A combinar",
    deadline: service.deadline ?? "A combinar",
    address: service.address,
    category: service.categoryLabel,
    description: service.description,
    imageUrls: service.imageUrls,
    hasReview: service.hasReview,
    messageCount: service.unreadMessages
      ? String(service.unreadMessages)
      : undefined,
  };
}
