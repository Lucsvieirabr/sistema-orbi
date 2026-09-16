import { useState } from "react";
import { Bug, Trash2, Eye, Image as ImageIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, PageToolbar, ToolbarSpacer } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useBugReports } from "@/hooks/use-bug-reports";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeImageSrc } from "@/lib/safe-url";

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo", color: "bg-primary" },
  { value: "em-analise", label: "Em Análise", color: "bg-warning" },
  { value: "em-desenvolvimento", label: "Em Desenvolvimento", color: "bg-chart-6" },
  { value: "resolvido", label: "Resolvido", color: "bg-success" },
  { value: "rejeitado", label: "Rejeitado", color: "bg-destructive" },
];

interface BugReportDetail {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string;
  imagem_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function BugReportsManagement() {
  const { bugReports, isLoading, updateBugReportStatus, deleteBugReport } = useBugReports(true);
  const [selectedReport, setSelectedReport] = useState<BugReportDetail | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draggedReport, setDraggedReport] = useState<BugReportDetail | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === status);
    return option?.color || "bg-border";
  };

  const getStatusLabel = (status: string) => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === status);
    return option?.label || status;
  };

  const handleViewDetails = (report: BugReportDetail) => {
    setSelectedReport(report);
    setDetailsOpen(true);
  };

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    try {
      await updateBugReportStatus(reportId, newStatus);
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      await deleteBugReport(reportId);
      if (selectedReport?.id === reportId) {
        setDetailsOpen(false);
        setSelectedReport(null);
      }
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  // Handlers para drag and drop
  const handleDragStart = (e: React.DragEvent, report: BugReportDetail) => {
    setDraggedReport(report);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    
    if (draggedReport && draggedReport.status !== targetStatus) {
      handleStatusChange(draggedReport.id, targetStatus);
    }
    
    setDraggedReport(null);
  };

  const handleDragEnd = () => {
    setDraggedReport(null);
  };

  // Agrupar por status
  const reportsByStatus = STATUS_OPTIONS.reduce((acc, status) => {
    acc[status.value] = bugReports.filter((report) => report.status === status.value);
    return acc;
  }, {} as Record<string, typeof bugReports>);

  return (
    <>
      <div className="min-w-0 space-y-5 md:space-y-7">
      <PageHeader
        eyebrow="Administração"
        icon={Bug}
        title="Defeitos & sugestões"
        description={`${bugReports.length} ${bugReports.length === 1 ? "relatório enviado" : "relatórios enviados"} pelos usuários. Arraste um cartão para mudar o estágio.`}
      />

        {/* Kanban Board */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
          {STATUS_OPTIONS.map((status) => (
            <div
              key={status.value}
              className="flex flex-col bg-muted/30 rounded-lg p-4 min-h-[600px] border-2 border-transparent transition-colors"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status.value)}
              style={{
                backgroundColor: draggedReport ? "rgba(0, 0, 0, 0.02)" : "transparent",
                borderColor: draggedReport ? "rgba(59, 130, 246, 0.3)" : "transparent",
              }}
            >
              {/* Status Header */}
              <div className="flex items-center gap-2 mb-4 pb-4 border-b">
                <div className={`w-3 h-3 rounded-full ${status.color}`} />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{status.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {reportsByStatus[status.value]?.length || 0}
                  </p>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {isLoading ? (
                  <>
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-24 rounded-lg" />
                  </>
                ) : reportsByStatus[status.value]?.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Nenhum relatório
                  </div>
                ) : (
                  reportsByStatus[status.value]?.map((report) => (
                    <div
                      key={report.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, report as BugReportDetail)}
                      onDragEnd={handleDragEnd}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <Card
                        className="transition-all bg-card hover:bg-card/80"
                        onClick={() => handleViewDetails(report as BugReportDetail)}
                      >
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-sm line-clamp-2">
                                {report.titulo}
                              </h4>
                              {report.imagem_url && (
                                <ImageIcon
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                  aria-label="Contém imagem"
                                />
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {report.descricao}
                            </p>

                            <div className="text-xs text-muted-foreground">
                              {format(new Date(report.created_at), "dd 'de' MMM", {
                                locale: ptBR,
                              })}
                            </div>

                            <div className="flex gap-1 pt-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(report as BugReportDetail);
                                }}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <ConfirmationDialog
                                title="Confirmar Exclusão"
                                description="Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita."
                                confirmText="Excluir"
                                cancelText="Cancelar"
                                variant="destructive"
                                onConfirm={() => handleDelete(report.id)}
                              >
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </ConfirmationDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-warning" />
              Detalhes do Relatório
            </DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedReport.titulo}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Descrição</label>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {selectedReport.descricao}
                </p>
              </div>

              {safeImageSrc(selectedReport.imagem_url) && (
                <div>
                  <label className="text-sm font-medium">Imagem</label>
                  <img
                    src={safeImageSrc(selectedReport.imagem_url)}
                    referrerPolicy="no-referrer"
                    alt={`Captura de tela anexada ao relatório: ${selectedReport.titulo ?? "bug"}`}
                    loading="lazy"
                    decoding="async"
                    className="mt-2 max-w-full max-h-64 rounded-lg border"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label className="text-sm font-medium">Criado em</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(selectedReport.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    defaultValue={selectedReport.status}
                    onValueChange={(value) => {
                      handleStatusChange(selectedReport.id, value);
                      setSelectedReport({
                        ...selectedReport,
                        status: value,
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-4 justify-end">
                <ConfirmationDialog
                  title="Confirmar Exclusão"
                  description="Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita."
                  confirmText="Excluir"
                  cancelText="Cancelar"
                  variant="destructive"
                  onConfirm={() => {
                    handleDelete(selectedReport.id);
                    setDetailsOpen(false);
                  }}
                >
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deletar
                  </Button>
                </ConfirmationDialog>
                <Button
                  variant="outline"
                  onClick={() => setDetailsOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
