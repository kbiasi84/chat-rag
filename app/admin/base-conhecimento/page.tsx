'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  createResource,
  deleteResource,
  getResourcesBySourceType,
  updateResource,
} from '@/lib/actions/resources';
import {
  createLink,
  getAllLinks,
  deleteLink,
  refreshLink,
} from '@/lib/actions/links';
import { uploadPdf } from '@/lib/actions/pdf';
import { toast } from 'sonner';
import { SourceType } from '@/lib/db/schema/resources';
import { nanoid } from '@/lib/utils';
import {
  countTokens,
  truncateToTokenLimit,
} from '@/lib/ai/utils/token-counter';
import { saveCuratedResource } from '@/lib/actions/curador';

// Definindo o tipo para os recursos
interface Resource {
  id: string;
  content: string;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Definindo o tipo para os links
interface WebLink {
  id: string;
  url: string;
  title: string;
  description: string | null;
  lastProcessed: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Constante para o limite máximo de tokens para chunks manuais
const MAX_MANUAL_CHUNK_TOKENS = 800;

export default function KnowledgeBasePage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'manual' | 'link' | 'pdf' | 'curador'>(
    'manual',
  );
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  // Estados para gerenciamento de links
  const [links, setLinks] = useState<WebLink[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkLei, setLinkLei] = useState('');
  const [linkContexto, setLinkContexto] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [isRefreshingLink, setIsRefreshingLink] = useState<string | null>(null);

  // Estados para chunk manual
  const [manualChunk, setManualChunk] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualLaw, setManualLaw] = useState('');
  const [manualContext, setManualContext] = useState('');
  const [manualTags, setManualTags] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualHierarchy, setManualHierarchy] = useState('');
  const [manualTokenCount, setManualTokenCount] = useState(0);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [previewManualChunk, setPreviewManualChunk] = useState('');

  // Estados de recursos por tipo
  const [linkResources, setLinkResources] = useState<Resource[]>([]);
  const [manualResources, setManualResources] = useState<Resource[]>([]);
  const [pdfResources, setPdfResources] = useState<Resource[]>([]);
  const [curadorResources, setCuradorResources] = useState<Resource[]>([]);

  // Estados para PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLei, setPdfLei] = useState('');
  const [pdfContexto, setPdfContexto] = useState('');
  const [isSubmittingPdf, setIsSubmittingPdf] = useState(false);

  // Estados para curador de legislação
  const [curadorLei, setCuradorLei] = useState('');
  const [curadorContexto, setCuradorContexto] = useState('');
  const [curadorTextoExtraido, setCuradorTextoExtraido] = useState('');
  const [curadorChunks, setCuradorChunks] = useState<string[]>([]);
  const [curadorTokenCount, setCuradorTokenCount] = useState(0);
  const [isExtractingCurador, setIsExtractingCurador] = useState(false);
  const [curadorTextSelection, setCuradorTextSelection] = useState<{start: number, end: number}[]>([]);
  const [showCuradorModal, setShowCuradorModal] = useState(false);

  useEffect(() => {
    loadResourcesByType();
    loadLinks();
  }, []);

  // Atualizar contagem de tokens para chunk manual
  const generateManualChunkPreview = useCallback(() => {
    let preview = '';

    if (manualTitle.trim()) {
      preview += `# ${manualTitle.trim()}\n\n`;
    }

    if (manualLaw.trim()) {
      preview += `**Lei:** ${manualLaw.trim()}\n\n`;
    }

    if (manualHierarchy.trim()) {
      preview += `**Hierarquia:** ${manualHierarchy.trim()}\n\n`;
    }

    if (manualContext.trim()) {
      preview += `**Contexto:** ${manualContext.trim()}\n\n`;
    }

    preview += manualChunk;

    if (manualCategory.trim()) {
      preview += `\n\n**Categoria:** ${manualCategory.trim()}`;
    }

    if (manualTags.trim()) {
      preview += `\n\n**Tags:** ${manualTags.trim()}`;
    }

    setPreviewManualChunk(preview);
  }, [
    manualChunk,
    manualTitle,
    manualLaw,
    manualContext,
    manualTags,
    manualCategory,
    manualHierarchy,
  ]);

  useEffect(() => {
    const count = countTokens(manualChunk);
    setManualTokenCount(count);

    // Gerar preview do chunk final
    generateManualChunkPreview();
  }, [
    manualChunk,
    manualTitle,
    manualLaw,
    manualContext,
    manualTags,
    manualCategory,
    manualHierarchy,
    generateManualChunkPreview,
  ]);

  const loadResourcesByType = async () => {
    setIsLoading(true);

    // Buscar recursos por tipo
    const textData = await getResourcesBySourceType(SourceType.TEXT);
    const linkData = await getResourcesBySourceType(SourceType.LINK);
    const pdfData = await getResourcesBySourceType(SourceType.PDF);

    // Separar recursos manuais (que têm sourceId começando com 'manual-')
    const manualData = textData.filter((resource) =>
      resource.sourceId?.startsWith('manual-'),
    );

    // Separar recursos curados (que têm sourceId começando com 'curador-')
    const curadorData = textData.filter((resource) =>
      resource.sourceId?.startsWith('curador-'),
    );

    setLinkResources(linkData);
    setManualResources(manualData);
    setPdfResources(pdfData);
    setCuradorResources(curadorData);

    setIsLoading(false);
  };

  const loadLinks = async () => {
    const data = await getAllLinks();
    setLinks(data);
  };

  // Função para carregar um recurso para edição
  const handleEditResource = (resource: Resource) => {
    // Verificar se é um chunk manual
    const isManualChunk = resource.sourceId?.startsWith('manual-');

    if (isManualChunk) {
      // Extrair metadados do chunk manual
      const lines = resource.content.split('\n');
      let extractedTitle = '';
      let extractedLaw = '';
      let extractedHierarchy = '';
      let extractedContext = '';
      let extractedCategory = '';
      let extractedTags = '';
      let extractedContent = '';

      let contentStartIndex = 0;

      // Extrair título
      if (lines[0]?.startsWith('# ')) {
        extractedTitle = lines[0].replace('# ', '');
        contentStartIndex = 2; // Pular título e linha vazia
      }

      // Extrair outros metadados
      const contentLines = [];
      let foundContent = false;

      for (let i = contentStartIndex; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('**Lei:**')) {
          extractedLaw = line.replace('**Lei:**', '').trim();
        } else if (line.startsWith('**Hierarquia:**')) {
          extractedHierarchy = line.replace('**Hierarquia:**', '').trim();
        } else if (line.startsWith('**Contexto:**')) {
          extractedContext = line.replace('**Contexto:**', '').trim();
        } else if (line.startsWith('**Categoria:**')) {
          extractedCategory = line.replace('**Categoria:**', '').trim();
        } else if (line.startsWith('**Tags:**')) {
          extractedTags = line.replace('**Tags:**', '').trim();
        } else {
          // Se não é um metadado, é conteúdo principal
          // Mas só adiciona se não for uma linha vazia no início
          if (line.trim() || foundContent) {
            contentLines.push(line);
            if (line.trim()) foundContent = true;
          }
        }
      }

      // Remover linhas vazias do final do conteúdo
      while (
        contentLines.length > 0 &&
        !contentLines[contentLines.length - 1].trim()
      ) {
        contentLines.pop();
      }

      extractedContent = contentLines.join('\n');

      // Carregar nos campos do chunk manual
      setManualTitle(extractedTitle);
      setManualLaw(extractedLaw);
      setManualHierarchy(extractedHierarchy);
      setManualContext(extractedContext);
      setManualCategory(extractedCategory);
      setManualTags(extractedTags);
      setManualChunk(extractedContent);
      setEditingResource(resource);
      setActiveTab('manual');
    } else {
      // Para chunks antigos (texto simples), extrair título e conteúdo
      let extractedTitle = '';
      let extractedContent = resource.content;

      if (resource.content.startsWith('# ')) {
        const contentParts = resource.content.split('\n\n');
        if (contentParts.length > 1) {
          extractedTitle = contentParts[0].replace(/^# /, '');
          extractedContent = contentParts.slice(1).join('\n\n');
        }
      }

      // Carregar como chunk manual para edição
      setManualTitle(extractedTitle);
      setManualLaw('');
      setManualHierarchy('');
      setManualContext('');
      setManualCategory('');
      setManualTags('');
      setManualChunk(extractedContent);
      setEditingResource(resource);
      setActiveTab('manual');
    }

    // Rolar para o topo da página para mostrar o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualChunk.trim()) {
      toast.error('O conteúdo do chunk não pode estar vazio');
      return;
    }

    if (manualTokenCount > MAX_MANUAL_CHUNK_TOKENS) {
      toast.error(
        `O conteúdo excede o limite de ${MAX_MANUAL_CHUNK_TOKENS} tokens`,
      );
      return;
    }

    setIsSubmittingManual(true);
    try {
      if (editingResource) {
        // Lógica para atualizar recurso existente
        const result = await updateResource({
          id: editingResource.id,
          content: previewManualChunk,
        });

        if (typeof result === 'string' && result.includes('success')) {
          toast.success('Chunk atualizado com sucesso');
          // Limpar formulário
          setManualChunk('');
          setManualTitle('');
          setManualLaw('');
          setManualContext('');
          setManualTags('');
          setManualCategory('');
          setManualHierarchy('');
          setManualTokenCount(0);
          setPreviewManualChunk('');
          setEditingResource(null);
          loadResourcesByType();
        } else {
          toast.error('Erro ao atualizar chunk');
        }
      } else {
        // Gerar um ID único para o chunk manual
        const manualId = `manual-${nanoid()}`;

        const result = await createResource({
          content: previewManualChunk,
          sourceType: SourceType.TEXT,
          sourceId: manualId,
        });

        if (typeof result === 'string' && result.includes('successfully')) {
          toast.success('Chunk manual adicionado com sucesso');
          // Limpar apenas o conteúdo do chunk, mantendo os metadados
          setManualChunk('');
          setManualTokenCount(0);
          setPreviewManualChunk('');
          loadResourcesByType();
        } else {
          toast.error('Erro ao adicionar chunk manual');
        }
      }
    } catch (error) {
      console.error('Erro ao processar chunk manual:', error);
      toast.error('Erro ao processar chunk manual');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim() || !linkTitle.trim()) {
      toast.error('URL e título são obrigatórios');
      return;
    }

    setIsSubmittingLink(true);
    try {
      const linkData: any = {
        url: linkUrl,
        title: linkTitle,
        description: linkDescription || null,
      };

      // Adicionar lei e contexto apenas se tiverem valores
      if (linkLei.trim()) {
        linkData.lei = linkLei;
      }
      if (linkContexto.trim()) {
        linkData.contexto = linkContexto;
      }

      const result = await createLink(linkData);

      toast.success('Link adicionado com sucesso');
      setLinkUrl('');
      setLinkTitle('');
      setLinkDescription('');
      setLinkLei('');
      setLinkContexto('');
      loadLinks();
      loadResourcesByType(); // Atualizar os recursos baseado no tipo
    } catch (error) {
      console.error(error);
      toast.error('Ocorreu um erro ao adicionar o link');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handlePdfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      toast.error('Selecione um arquivo PDF');
      return;
    }

    setIsSubmittingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);

      // Adicionar metadados apenas se tiverem valores
      if (pdfLei.trim()) {
        formData.append('lei', pdfLei);
      }
      if (pdfContexto.trim()) {
        formData.append('contexto', pdfContexto);
      }

      const result = await uploadPdf(formData);

      if (result.success) {
        toast.success(result.message);
        setPdfFile(null);
        setPdfLei('');
        setPdfContexto('');
        loadResourcesByType();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Ocorreu um erro ao processar o PDF');
    } finally {
      setIsSubmittingPdf(false);
    }
  };

  const handleRefreshLink = async (id: string) => {
    setIsRefreshingLink(id);
    try {
      const result = await refreshLink(id);
      toast.success('Conteúdo do link atualizado com sucesso');
      loadResourcesByType(); // Atualizar recursos por tipo em vez de todos
    } catch (error) {
      console.error(error);
      toast.error('Falha ao atualizar o conteúdo do link');
    } finally {
      setIsRefreshingLink(null);
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (
      confirm(
        'Tem certeza que deseja excluir este link? Isso TAMBÉM removerá o conteúdo processado.',
      )
    ) {
      try {
        const result = await deleteLink(id);
        toast.success('Link e conteúdo associado excluídos com sucesso');
        loadLinks();
        loadResourcesByType(); // Recarregar recursos por tipo
      } catch (error) {
        console.error(error);
        toast.error('Erro ao excluir o link');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        'Tem certeza que deseja excluir este item? Essa ação não pode ser desfeita.',
      )
    ) {
      const result = await deleteResource(id);
      if (result.includes('sucesso')) {
        toast.success('Recurso excluído com sucesso');
        loadResourcesByType(); // Recarregar recursos por tipo
      } else {
        toast.error('Erro ao excluir o recurso');
      }
    }
  };

  // Função para limitar o texto do chunk manual
  const handleManualChunkChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const newValue = e.target.value;

    // Verificar se excede o limite de tokens
    const tokenCount = countTokens(newValue);

    if (tokenCount > MAX_MANUAL_CHUNK_TOKENS) {
      // Truncar o conteúdo para o limite de tokens
      const truncatedValue = truncateToTokenLimit(
        newValue,
        MAX_MANUAL_CHUNK_TOKENS,
      );
      setManualChunk(truncatedValue);
      // Mostrar um aviso
      toast.warning('Conteúdo truncado para respeitar o limite de tokens.');
    } else {
      setManualChunk(newValue);
    }
  };

  // Funções para o curador de legislação
  const handleCuradorExtractText = () => {
    // Redirecionar para modal manual
    handleCuradorOpenModal();
  };

  const handleCuradorUpdateText = (newText: string) => {
    setCuradorTextoExtraido(newText);
    setCuradorTokenCount(countTokens(newText));
    // Resetar chunks quando o texto for modificado
    setCuradorChunks([]);
    setCuradorTextSelection([]);
  };

  // Função leve que só atualiza o HTML sem processamento pesado
  const handleCuradorHtmlContentChange = (htmlContent: string) => {
    // Função removida - agora usamos apenas texto simples
    // setCuradorHtmlEstruturado(htmlContent);
    // Limpar chunks quando o conteúdo for modificado
    setCuradorChunks([]);
  };

  // Função para atualizar contagem de tokens (chamada apenas quando necessário)
  const updateTokenCount = () => {
    // Função simplificada - tokens são atualizados automaticamente
    setCuradorTokenCount(countTokens(curadorTextoExtraido));
  };

  const insertChunkMarker = () => {
    const textarea = document.querySelector('textarea[value]') as HTMLTextAreaElement;
    if (textarea) {
      const cursorPosition = textarea.selectionStart || 0;
      const beforeCursor = curadorTextoExtraido.substring(0, cursorPosition);
      const afterCursor = curadorTextoExtraido.substring(cursorPosition);
      const newText = beforeCursor + '\n\n---CHUNK---\n\n' + afterCursor;
      
      setCuradorTextoExtraido(newText);
      setCuradorChunks([]); // Limpar chunks
      
      // Posicionar o cursor após o marcador
      setTimeout(() => {
        const newCursorPosition = cursorPosition + '\n\n---CHUNK---\n\n'.length;
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        textarea.focus();
      }, 0);
    }
  };

  const removeSelectedContent = () => {
    const textarea = document.querySelector('textarea[value]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      if (start !== end) {
        const beforeSelection = curadorTextoExtraido.substring(0, start);
        const afterSelection = curadorTextoExtraido.substring(end);
        const newText = beforeSelection + afterSelection;
        setCuradorTextoExtraido(newText);
        setCuradorChunks([]);
        
        // Manter o cursor na posição
        setTimeout(() => {
          textarea.setSelectionRange(start, start);
          textarea.focus();
        }, 0);
      }
    }
  };

  const handleCuradorMarkChunk = () => {
    // Atualizar contagem de tokens
    setCuradorTokenCount(countTokens(curadorTextoExtraido));
    
    // Processar o texto para extrair chunks
    const lines = curadorTextoExtraido.split('\n');
    const chunks = [];
    let currentChunk = '';
    
    for (const line of lines) {
      if (line.trim().startsWith('---CHUNK---')) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    setCuradorChunks(chunks);
  };

  const handleCuradorSaveChunks = async () => {
    if (curadorChunks.length === 0) {
      toast.error('Nenhum chunk para salvar.');
      return;
    }

    try {
      // Montar o conteúdo completo do recurso (fonte única)
      let fullContent = '';
      
      if (curadorLei.trim()) {
        fullContent += `**Lei:** ${curadorLei.trim()}\n\n`;
      }
      
      if (curadorContexto.trim()) {
        fullContent += `**Contexto:** ${curadorContexto.trim()}\n\n`;
      }
      
      fullContent += curadorTextoExtraido.trim();
      
      // Usar a nova função que salva um recurso único com embeddings para cada chunk
      const result = await saveCuratedResource({
        chunks: curadorChunks,
        lei: curadorLei,
        contexto: curadorContexto,
        fullContent: fullContent,
      });
      
      if (result.success) {
        toast.success(result.message);
        
        // Resetar formulário
        setCuradorLei('');
        setCuradorContexto('');
        setCuradorTextoExtraido('');
        setCuradorChunks([]);
        setCuradorTokenCount(0);
        setCuradorTextSelection([]);
        
        // Recarregar recursos
        loadResourcesByType();
      } else {
        throw new Error(result.message || 'Erro ao salvar o recurso curado');
      }
    } catch (error) {
      console.error('Erro ao salvar recurso curado:', error);
      toast.error('Erro ao salvar recurso curado');
    }
  };

  // Funções para o curador de legislação
  const handleCuradorOpenModal = () => {
    // Abrir a modal diretamente para inserção manual do texto
    setShowCuradorModal(true);
    
    if (!curadorTextoExtraido) {
      toast.success('Cole o texto copiado da página na área de edição.');
    }
  };

  // Função para calcular tokens do último chunk
  const getLastChunkTokens = () => {
    if (!curadorTextoExtraido.trim()) return 0;
    
    const text = curadorTextoExtraido;
    const chunkMarker = '---CHUNK---';
    
    // Encontrar todas as posições dos marcadores
    const chunkPositions = [];
    let pos = text.indexOf(chunkMarker);
    while (pos !== -1) {
      chunkPositions.push(pos);
      pos = text.indexOf(chunkMarker, pos + 1);
    }
    
    let chunkToCount;
    
    if (chunkPositions.length === 0) {
      // Sem marcadores: conta todo o texto
      chunkToCount = text;
    } else if (chunkPositions.length === 1) {
      // Um marcador: conta o texto antes do marcador
      chunkToCount = text.substring(0, chunkPositions[0]);
    } else {
      // Múltiplos marcadores: conta o texto entre o penúltimo e último marcador
      const penultimoIndex = chunkPositions[chunkPositions.length - 2];
      const ultimoIndex = chunkPositions[chunkPositions.length - 1];
      const startIndex = penultimoIndex + chunkMarker.length;
      chunkToCount = text.substring(startIndex, ultimoIndex);
    }
    
    // Remover linhas vazias do início e do final
    chunkToCount = chunkToCount.trim();
    
    return countTokens(chunkToCount);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 pb-10">
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 py-8">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-medium mb-4 dark:text-white">
            Adicionar Novo Conteúdo
          </h2>

          {/* Abas para escolher o tipo de conteúdo */}
          <div className="flex border-b mb-6">
            <button
              type="button"
              className={`px-4 py-2 font-medium ${
                activeTab === 'manual'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
              onClick={() => setActiveTab('manual')}
            >
              Chunk Manual
            </button>
            <button
              type="button"
              className={`px-4 py-2 font-medium ${
                activeTab === 'link'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
              onClick={() => setActiveTab('link')}
            >
              Link da Web
            </button>
            <button
              type="button"
              className={`px-4 py-2 font-medium ${
                activeTab === 'pdf'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
              onClick={() => setActiveTab('pdf')}
            >
              PDF
            </button>
            <button
              type="button"
              className={`px-4 py-2 font-medium ${
                activeTab === 'curador'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
              onClick={() => setActiveTab('curador')}
            >
              Curador de Legislação
            </button>
          </div>

          {activeTab === 'manual' ? (
            <form onSubmit={handleManualSubmit} className="space-y-6">
              {/* Layout em duas colunas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Coluna da esquerda - Metadados */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-neutral-700 dark:text-neutral-300 border-b pb-2">
                    Metadados
                  </h3>

                  <div>
                    <label
                      htmlFor="manual-title"
                      className="block text-sm font-medium mb-2 dark:text-neutral-200"
                    >
                      Título
                    </label>
                    <Input
                      id="manual-title"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Ex: Art. 157 da CLT - Equipamentos de Proteção Individual"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="manual-law"
                      className="block text-sm font-medium mb-2 dark:text-neutral-200"
                    >
                      Lei
                    </label>
                    <Input
                      id="manual-law"
                      value={manualLaw}
                      onChange={(e) => setManualLaw(e.target.value)}
                      placeholder="Ex: CLT, Lei 8.213/91, Código Civil"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="manual-context"
                      className="block text-sm font-medium mb-2 dark:text-neutral-200"
                    >
                      Contexto
                    </label>
                    <Textarea
                      id="manual-context"
                      value={manualContext}
                      onChange={(e) => setManualContext(e.target.value)}
                      rows={4}
                      placeholder="Ex: Este artigo trata da obrigatoriedade do uso de EPIs no ambiente de trabalho..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="manual-category"
                        className="block text-sm font-medium mb-2 dark:text-neutral-200"
                      >
                        Categoria
                      </label>
                      <Input
                        id="manual-category"
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        placeholder="Ex: Segurança do Trabalho"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="manual-hierarchy"
                        className="block text-sm font-medium mb-2 dark:text-neutral-200"
                      >
                        Hierarquia
                      </label>
                      <Input
                        id="manual-hierarchy"
                        value={manualHierarchy}
                        onChange={(e) => setManualHierarchy(e.target.value)}
                        placeholder="Ex: CLT > Capítulo V > Seção IV"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="manual-tags"
                      className="block text-sm font-medium mb-2 dark:text-neutral-200"
                    >
                      Tags (separadas por vírgula)
                    </label>
                    <Input
                      id="manual-tags"
                      value={manualTags}
                      onChange={(e) => setManualTags(e.target.value)}
                      placeholder="Ex: EPI, segurança, obrigatoriedade, responsabilidade"
                    />
                  </div>
                </div>

                {/* Coluna da direita - Conteúdo */}
                <div className="space-y-4 flex flex-col h-full">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-md font-medium text-neutral-700 dark:text-neutral-300">
                      Conteúdo do Chunk
                    </h3>
                    <p
                      className={`text-sm ${manualTokenCount > MAX_MANUAL_CHUNK_TOKENS ? 'text-red-500 font-semibold' : manualTokenCount > MAX_MANUAL_CHUNK_TOKENS * 0.9 ? 'text-amber-500' : 'text-green-600'}`}
                    >
                      {manualTokenCount} / {MAX_MANUAL_CHUNK_TOKENS} tokens
                    </p>
                  </div>

                  <div className="flex-1 flex flex-col">
                    <Textarea
                      id="manual-chunk"
                      value={manualChunk}
                      onChange={handleManualChunkChange}
                      className="flex-1 resize-none min-h-[350px]"
                      placeholder={`Ex: Art. 157 - Cabe às empresas:

I - cumprir e fazer cumprir as normas de segurança e medicina do trabalho;
II - instruir os empregados, através de ordens de serviço, quanto às precauções a tomar no sentido de evitar acidentes do trabalho ou doenças ocupacionais;
III - adotar as medidas que lhes sejam determinadas pelo órgão regional competente;
IV - facilitar o exercício da fiscalização pela autoridade competente.

Art. 158 - Cabe aos empregados:
I - observar as normas de segurança e medicina do trabalho, inclusive as instruções de que trata o item II do artigo anterior;
II - colaborar com a empresa na aplicação dos dispositivos deste Capítulo.

Parágrafo único - Constitui ato faltoso do empregado a recusa injustificada:
a) à observância das instruções expedidas pelo empregador na forma do item II do artigo anterior;
b) ao uso dos equipamentos de proteção individual fornecidos pela empresa.`}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-2">
                      Inclua o conteúdo completo com contexto suficiente para
                      compreensão autônoma.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex space-x-2 pt-4 border-t">
                <Button
                  type="submit"
                  disabled={
                    isSubmittingManual ||
                    !manualChunk.trim() ||
                    manualTokenCount > MAX_MANUAL_CHUNK_TOKENS
                  }
                >
                  {isSubmittingManual
                    ? 'Processando...'
                    : editingResource
                      ? 'Atualizar Chunk'
                      : 'Adicionar Chunk Manual'}
                </Button>
                {editingResource && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingResource(null);
                      setManualChunk('');
                      setManualTitle('');
                      setManualLaw('');
                      setManualContext('');
                      setManualTags('');
                      setManualCategory('');
                      setManualHierarchy('');
                      setManualTokenCount(0);
                      setPreviewManualChunk('');
                    }}
                  >
                    Cancelar Edição
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setManualChunk('');
                    setManualTokenCount(0);
                    setPreviewManualChunk('');
                  }}
                >
                  Limpar Conteúdo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setManualChunk('');
                    setManualTitle('');
                    setManualLaw('');
                    setManualContext('');
                    setManualTags('');
                    setManualCategory('');
                    setManualHierarchy('');
                    setManualTokenCount(0);
                    setPreviewManualChunk('');
                  }}
                >
                  Limpar Tudo
                </Button>
              </div>

              {/* Preview do chunk final - largura completa */}
              {previewManualChunk && (
                <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 bg-neutral-50 dark:bg-neutral-900">
                  <h4 className="text-sm font-medium mb-2 dark:text-neutral-200">
                    Preview do Chunk Final ({countTokens(previewManualChunk)}{' '}
                    tokens)
                  </h4>
                  <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {previewManualChunk}
                  </div>
                </div>
              )}
            </form>
          ) : activeTab === 'link' ? (
            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="link-url"
                  className="block text-sm font-medium mb-2 dark:text-neutral-200"
                >
                  URL
                </label>
                <Input
                  id="link-url"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://exemplo.com/pagina"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="link-title"
                  className="block text-sm font-medium mb-2 dark:text-neutral-200"
                >
                  Título
                </label>
                <Input
                  id="link-title"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Título para identificar este link"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="link-lei"
                  className="block text-sm font-medium mb-2 dark:text-neutral-200"
                >
                  Lei (opcional - sem limite de tamanho)
                </label>
                <Textarea
                  id="link-lei"
                  value={linkLei}
                  onChange={(e) => setLinkLei(e.target.value)}
                  rows={2}
                  placeholder="Ex: Lei 8.213/91 - Dispõe sobre os Planos de Benefícios da Previdência Social e dá outras providências..."
                />
                <p className="text-xs text-gray-500 mt-1 dark:text-neutral-400">
                  Informações detalhadas sobre a legislação aplicável. Este
                  campo será incluído em todos os chunks gerados.
                </p>
              </div>
              <div>
                <label
                  htmlFor="link-contexto"
                  className="block text-sm font-medium mb-2 dark:text-neutral-200"
                >
                  Contexto (opcional - sem limite de tamanho)
                </label>
                <Textarea
                  id="link-contexto"
                  value={linkContexto}
                  onChange={(e) => setLinkContexto(e.target.value)}
                  rows={3}
                  placeholder="Descrição detalhada do contexto legal, jurisprudencial ou temático desta fonte. Inclua informações sobre aplicabilidade, âmbito de atuação, relações com outras normas, etc."
                />
                <p className="text-xs text-gray-500 mt-1 dark:text-neutral-400">
                  Contexto detalhado que ajudará a IA a compreender melhor o
                  conteúdo. Este campo será incluído em todos os chunks gerados.
                </p>
              </div>
              <div>
                <label
                  htmlFor="link-description"
                  className="block text-sm font-medium mb-2 dark:text-neutral-200"
                >
                  Descrição (opcional)
                </label>
                <Textarea
                  id="link-description"
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  rows={3}
                  placeholder="Breve descrição sobre este link"
                />
                <p className="text-xs text-gray-500 mt-1 dark:text-neutral-400">
                  A página será acessada automaticamente e seu conteúdo será
                  extraído para a base de conhecimento.
                </p>
              </div>
              <Button
                type="submit"
                disabled={
                  isSubmittingLink || !linkUrl.trim() || !linkTitle.trim()
                }
              >
                {isSubmittingLink
                  ? 'Processando...'
                  : 'Adicionar Link e Extrair Conteúdo'}
              </Button>
            </form>
          ) : activeTab === 'pdf' ? (
            <form onSubmit={handlePdfSubmit} className="space-y-6">
              {/* Layout em duas colunas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Coluna da esquerda - Metadados */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-neutral-700 dark:text-neutral-300 border-b pb-2">
                    Metadados
                  </h3>

                  <div>
                    <label
                      htmlFor="pdf-lei"
                      className="block text-sm font-medium mb-2 dark:text-neutral-200"
                    >
                      Lei (opcional - sem limite de tamanho)
                    </label>
                    <Textarea
                      id="pdf-lei"
                      value={pdfLei}
                      onChange={(e) => setPdfLei(e.target.value)}
                      rows={2}
                      placeholder="Ex: Lei 8.213/91 - Dispõe sobre os Planos de Benefícios da Previdência Social e dá outras providências..."
                    />
                    <p className="text-xs text-gray-500 mt-1 dark:text-neutral-400">
                      Informações detalhadas sobre a legislação aplicável. Este
                      campo será incluído em todos os chunks gerados.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="pdf-contexto"
                      className="block text-sm font-medium mb-2 dark:text-neutral-200"
                    >
                      Contexto (opcional - sem limite de tamanho)
                    </label>
                    <Textarea
                      id="pdf-contexto"
                      value={pdfContexto}
                      onChange={(e) => setPdfContexto(e.target.value)}
                      rows={3}
                      placeholder="Descrição detalhada do contexto legal, jurisprudencial ou temático desta fonte. Inclua informações sobre aplicabilidade, âmbito de atuação, relações com outras normas, etc."
                    />
                    <p className="text-xs text-gray-500 mt-1 dark:text-neutral-400">
                      Contexto detalhado que ajudará a IA a compreender melhor o
                      conteúdo. Este campo será incluído em todos os chunks
                      gerados.
                    </p>
                  </div>
                </div>

                {/* Coluna da direita - Conteúdo */}
                <div className="space-y-4 flex flex-col h-full">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-md font-medium text-neutral-700 dark:text-neutral-300">
                      Conteúdo do PDF
                    </h3>
                  </div>

                  <div className="flex-1 flex flex-col">
                    <Input
                      id="pdf-file"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files) {
                          const file = e.target.files[0];
                          setPdfFile(file);
                        }
                      }}
                      className="flex-1"
                    />
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-2">
                      Selecione um arquivo PDF (tamanho máximo: 10MB). O arquivo
                      será processado e dividido em chunks para busca semântica.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex space-x-2 pt-4 border-t">
                <Button type="submit" disabled={isSubmittingPdf || !pdfFile}>
                  {isSubmittingPdf
                    ? 'Processando...'
                    : 'Adicionar PDF e Extrair Conteúdo'}
                </Button>
              </div>
            </form>
          ) : activeTab === 'curador' ? (
            <div className="space-y-6">
              {/* Curador de Legislação */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna 1: Configurações */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-neutral-700 dark:text-neutral-300 border-b pb-2">
                    📋 Metadados
                  </h3>

                  <div>
                    <label
                      htmlFor="curador-lei"
                      className="block text-sm font-medium mb-2 dark:text-neutral-200"
                    >
                      Lei/Norma
                    </label>
                    <Textarea
                      id="curador-lei"
                      value={curadorLei}
                      onChange={(e) => setCuradorLei(e.target.value)}
                      rows={2}
                      placeholder="Ex: Lei 8.213/91 - Planos de Benefícios da Previdência Social"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="curador-contexto"
                      className="block text-sm font-medium mb-2 dark:text-neutral-200"
                    >
                      Contexto
                    </label>
                    <Textarea
                      id="curador-contexto"
                      value={curadorContexto}
                      onChange={(e) => setCuradorContexto(e.target.value)}
                      rows={3}
                      placeholder="Contexto jurídico, aplicabilidade, relacionamento com outras normas..."
                    />
                  </div>

                  <Button
                    onClick={handleCuradorExtractText}
                    className="w-full"
                  >
                    📝 Iniciar Edição de Texto
                  </Button>

                  {curadorTextoExtraido && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                        ✅ Texto curado: {curadorTokenCount.toLocaleString()} tokens
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Edite o texto na modal e marque os chunks manualmente
                      </p>
                    </div>
                  )}
                </div>

                {/* Coluna 2: Preview/Status */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-md font-medium text-neutral-700 dark:text-neutral-300">
                      📄 Preview do Conteúdo
                    </h3>
                    <div className="flex items-center space-x-2">
                      {curadorTextoExtraido && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {curadorTokenCount.toLocaleString()} tokens total
                        </span>
                      )}
                    </div>
                  </div>

                  {!curadorTextoExtraido ? (
                    <div className="text-center py-12 text-gray-500 dark:text-neutral-400">
                      <p className="text-sm">📄 Nenhum texto curado ainda</p>
                      <p className="text-xs mt-1">Clique em &quot;Iniciar Edição de Texto&quot; para começar</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 max-h-80 overflow-y-scroll">
                      <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
                        {curadorTextoExtraido.length > 1000 
                          ? `${curadorTextoExtraido.substring(0, 1000)}...` 
                          : curadorTextoExtraido}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Coluna 3: Chunks Criados */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-md font-medium text-neutral-700 dark:text-neutral-300">
                      📦 Chunks Criados
                    </h3>
                    {curadorChunks.length > 0 && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        {curadorChunks.length} chunks
                      </span>
                    )}
                  </div>

                  {curadorChunks.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-neutral-400">
                      <p className="text-sm">📋 Nenhum chunk criado ainda</p>
                      <p className="text-xs mt-1">Processe o texto para visualizar os chunks</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {curadorChunks.map((chunk, index) => {
                        const chunkTokens = countTokens(chunk);
                        return (
                          <div key={index} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 bg-gray-50 dark:bg-neutral-800">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                Chunk {index + 1}
                              </h4>
                              <div className="flex space-x-2">
                                <span className={`text-xs px-2 py-1 rounded ${chunkTokens > 800 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : chunkTokens > 720 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
                                  {chunkTokens} tokens
                                </span>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    const newChunks = curadorChunks.filter((_, i) => i !== index);
                                    setCuradorChunks(newChunks);
                                  }}
                                  className="h-6 w-6 p-0 text-xs"
                                >
                                  ×
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-4">
                              {chunk.length > 150 ? `${chunk.substring(0, 150)}...` : chunk}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {curadorChunks.length > 0 && (
                    <div className="space-y-3 pt-3 border-t">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                          📊 Resumo
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {curadorChunks.length} chunks • {curadorChunks.reduce((total, chunk) => total + countTokens(chunk), 0).toLocaleString()} tokens total
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Média: {Math.round(curadorChunks.reduce((total, chunk) => total + countTokens(chunk), 0) / curadorChunks.length)} tokens/chunk
                        </p>
                      </div>

                      <Button
                        onClick={handleCuradorSaveChunks}
                        disabled={curadorChunks.length === 0}
                        className="w-full"
                      >
                        💾 Salvar {curadorChunks.length} Chunks
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal em Tela Cheia para Edição de Texto */}
        {showCuradorModal && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-neutral-900">
            {/* Header da Modal */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold dark:text-white">
                  📝 Curador de Legislação - Editor em Tela Cheia
                </h2>
                <div className="flex items-center space-x-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <span>📊 {curadorTokenCount.toLocaleString()} tokens</span>
                  {curadorChunks.length > 0 && (
                    <span>• 📦 {curadorChunks.length} chunks</span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleCuradorMarkChunk}
                  disabled={!curadorTextoExtraido.trim()}
                  variant="outline"
                  size="sm"
                >
                  🔄 Processar Chunks
                </Button>
                <Button
                  onClick={handleCuradorSaveChunks}
                  disabled={curadorChunks.length === 0}
                  size="sm"
                >
                  💾 Salvar {curadorChunks.length} Chunks
                </Button>
                <Button
                  onClick={() => setShowCuradorModal(false)}
                  variant="outline"
                  size="sm"
                >
                  ✕ Fechar
                </Button>
              </div>
            </div>

            {/* Conteúdo da Modal */}
            <div className="flex-1 flex overflow-hidden">
              {/* Painel Principal - Visualização Estruturada */}
              <div className="flex-1 flex flex-col p-6 overflow-hidden min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium dark:text-white">
                    Visualização
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-neutral-600 dark:text-neutral-400">
                    <span><strong>Lei:</strong> {curadorLei || 'Não informada'}</span>
                    {curadorTextoExtraido && (
                      <span className={`font-medium ${(() => {
                        const lastChunkTokens = getLastChunkTokens();
                        if (lastChunkTokens > MAX_MANUAL_CHUNK_TOKENS) return 'text-red-600';
                        if (lastChunkTokens > MAX_MANUAL_CHUNK_TOKENS * 0.9) return 'text-orange-600';
                        return 'text-green-600';
                      })()}`}>
                        <strong>Último chunk:</strong> {getLastChunkTokens()}/{MAX_MANUAL_CHUNK_TOKENS} tokens
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  {/* Toolbar para edição estruturada */}
                  <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      💡 <strong>Instruções:</strong> Edite o texto livremente. Para dividir em chunks, digite <strong>---CHUNK---</strong> em linha separada e clique em &quot;Processar Chunks&quot;.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText('---CHUNK---');
                        toast.success('---CHUNK--- copiado!');
                      }}
                      className="ml-2 text-xs"
                    >
                      📋 Copiar ---CHUNK---
                    </Button>
                  </div>

                  {/* Área editável simples - Textarea */}
                  <textarea
                    className="flex-1 w-full h-full border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm leading-relaxed"
                    value={curadorTextoExtraido}
                    onChange={(e) => {
                      setCuradorTextoExtraido(e.target.value);
                      setCuradorChunks([]); // Limpar chunks quando editar
                    }}
                    placeholder="O texto extraído aparecerá aqui. Você pode editar livremente, adicionar conteúdo, e inserir marcadores ---CHUNK--- onde quiser dividir o texto."
                  />
                </div>
              </div>

              {/* Painel Lateral - Chunks */}
              <div className="w-80 border-l border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-4 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium dark:text-white">
                    📦 Chunks Criados
                  </h3>
                  {curadorChunks.length > 0 && (
                    <span className="text-sm text-green-600 dark:text-green-400">
                      {curadorChunks.length} chunks
                    </span>
                  )}
                </div>

                {curadorChunks.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center text-gray-500 dark:text-neutral-400">
                    <div>
                      <p className="text-sm mb-2">📋 Nenhum chunk criado ainda</p>
                      <p className="text-xs">Adicione marcadores ---CHUNK--- no texto e clique em &quot;Processar Chunks&quot;</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {curadorChunks.map((chunk, index) => {
                      const chunkTokens = countTokens(chunk);
                      return (
                        <div key={index} className="border border-neutral-200 dark:border-neutral-600 rounded-lg p-3 bg-white dark:bg-neutral-700">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                              Chunk {index + 1}
                            </h4>
                            <div className="flex space-x-2">
                              <span className={`text-xs px-2 py-1 rounded ${chunkTokens > 800 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : chunkTokens > 720 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
                                {chunkTokens} tokens
                              </span>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  const newChunks = curadorChunks.filter((_, i) => i !== index);
                                  setCuradorChunks(newChunks);
                                }}
                                className="h-6 w-6 p-0 text-xs"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 max-h-32 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-mono">
                              {chunk.length > 200 ? `${chunk.substring(0, 200)}...` : chunk}
                            </pre>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {curadorChunks.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-600">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                        📊 Resumo da Curadoria
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        • {curadorChunks.length} chunks criados
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        • {curadorChunks.reduce((total, chunk) => total + countTokens(chunk), 0).toLocaleString()} tokens total
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        • Média: {Math.round(curadorChunks.reduce((total, chunk) => total + countTokens(chunk), 0) / curadorChunks.length)} tokens/chunk
                      </p>
                    </div>

                    <Button
                      onClick={() => {
                        handleCuradorSaveChunks();
                        setShowCuradorModal(false);
                      }}
                      className="w-full"
                    >
                      💾 Salvar e Fechar ({curadorChunks.length} chunks)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Seção de links monitorados */}
        {activeTab === 'link' && (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-lg font-medium mb-4 dark:text-white">
              Links Monitorados
            </h2>

            {links.length === 0 ? (
              <p className="text-center py-6 text-neutral-500 dark:text-neutral-400">
                Nenhum link monitorado encontrado.
              </p>
            ) : (
              <div className="space-y-4">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold dark:text-white">
                          {link.title}
                        </h3>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:underline mb-2 inline-block"
                        >
                          {link.url}
                        </a>
                        {link.description && (
                          <p className="text-sm dark:text-neutral-300 mt-1">
                            {link.description}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                          Última atualização:{' '}
                          {new Date(link.lastProcessed).toLocaleDateString(
                            'pt-BR',
                            {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isRefreshingLink === link.id}
                          onClick={() => handleRefreshLink(link.id)}
                          className="whitespace-nowrap"
                        >
                          {isRefreshingLink === link.id
                            ? 'Atualizando...'
                            : 'Atualizar Agora'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteLink(link.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4 dark:text-white">
            Conteúdos na Base de Conhecimento
          </h2>

          {isLoading ? (
            <p className="text-center py-10 text-neutral-500 dark:text-neutral-400">
              Carregando conteúdos...
            </p>
          ) : (
            <>
              {/* Renderizar conteúdos com base na aba ativa */}
              {activeTab === 'manual' && (
                <>
                  <h3 className="text-md font-medium mb-3 dark:text-neutral-300">
                    Chunks Manuais Adicionados
                  </h3>
                  {manualResources.length === 0 ? (
                    <p className="text-center py-6 text-neutral-500 dark:text-neutral-400">
                      Nenhum chunk manual adicionado.
                    </p>
                  ) : (
                    <div className="space-y-4 mb-8">
                      {manualResources.map((resource) => (
                        <ResourceItem
                          key={resource.id}
                          resource={resource}
                          onDelete={handleDelete}
                          onEdit={handleEditResource}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'link' && (
                <>
                  <h3 className="text-md font-medium mb-3 dark:text-neutral-300">
                    Conteúdos Extraídos de Links
                  </h3>
                  {linkResources.length === 0 ? (
                    <p className="text-center py-6 text-neutral-500 dark:text-neutral-400">
                      Nenhum conteúdo de link adicionado.
                    </p>
                  ) : (
                    <div className="space-y-4 mb-8">
                      {linkResources.map((resource) => (
                        <ResourceItem
                          key={resource.id}
                          resource={resource}
                          onDelete={handleDelete}
                          onEdit={handleEditResource}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'pdf' && (
                <>
                  <h3 className="text-md font-medium mb-3 dark:text-neutral-300">
                    Conteúdos Extraídos de PDFs
                  </h3>
                  {pdfResources.length === 0 ? (
                    <p className="text-center py-6 text-neutral-500 dark:text-neutral-400">
                      Nenhum conteúdo de PDF adicionado.
                    </p>
                  ) : (
                    <div className="space-y-4 mb-8">
                      {pdfResources.map((resource) => (
                        <ResourceItem
                          key={resource.id}
                          resource={resource}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'curador' && (
                <>
                  <h3 className="text-md font-medium mb-3 dark:text-neutral-300">
                    Chunks Curados de Legislação
                  </h3>
                  {curadorResources.length === 0 ? (
                    <p className="text-center py-6 text-neutral-500 dark:text-neutral-400">
                      Nenhum chunk curado adicionado.
                    </p>
                  ) : (
                    <div className="space-y-4 mb-8">
                      {curadorResources.map((resource) => (
                        <ResourceItem
                          key={resource.id}
                          resource={resource}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// Componente para exibir um item de recurso
const ResourceItem = ({
  resource,
  onDelete,
  onEdit,
}: {
  resource: Resource;
  onDelete: (id: string) => void;
  onEdit?: (resource: Resource) => void;
}) => {
  // Calculando tokens do conteúdo do recurso
  const resourceTokens = countTokens(resource.content);

  // Verificar se é um chunk manual
  const isManualChunk = resource.sourceId?.startsWith('manual-');

  // Verificar se é um chunk curado
  const isCuratedChunk = resource.sourceId?.startsWith('curador-');

  // Extrair metadados do chunk curado
  const extractCuratedMetadata = (content: string) => {
    const lines = content.split('\n');
    const metadata: { [key: string]: string } = {};
    let contentStart = 0;

    // Extrair título
    if (lines[0]?.startsWith('# ')) {
      metadata.title = lines[0].replace('# ', '');
      contentStart = 2; // Pular título e linha vazia
    }

    // Extrair outros metadados
    const contentLines: string[] = [];
    let foundContent = false;

    for (let i = contentStart; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('**Lei:**')) {
        metadata.law = line.replace('**Lei:**', '').trim();
      } else if (line.startsWith('**Contexto:**')) {
        metadata.context = line.replace('**Contexto:**', '').trim();
      } else if (line.startsWith('**Fonte:**')) {
        metadata.source = line.replace('**Fonte:**', '').trim();
      } else if (line.startsWith('**Tipo:**')) {
        metadata.type = line.replace('**Tipo:**', '').trim();
      } else if (line.startsWith('**Sessão:**')) {
        metadata.session = line.replace('**Sessão:**', '').trim();
      } else {
        // Se não é um metadado, é conteúdo principal
        // Mas só adiciona se não for uma linha vazia no início
        if (line.trim() || foundContent) {
          contentLines.push(line);
          if (line.trim()) foundContent = true;
        }
      }
    }

    // Remover linhas vazias do final do conteúdo
    while (
      contentLines.length > 0 &&
      !contentLines[contentLines.length - 1].trim()
    ) {
      contentLines.pop();
    }

    metadata.content = contentLines.join('\n');

    return metadata;
  };

  const curatedMetadata = isCuratedChunk
    ? extractCuratedMetadata(resource.content)
    : null;

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
      <div className="flex justify-between">
        <div className="flex-1">
          {isManualChunk && (
            // Layout especial para chunks manuais
            <div className="space-y-2">
              <h4 className="font-semibold text-base dark:text-white">
                {resource.content.split('\n')[0].replace(/^#\s+/, '') ||
                  'Chunk Manual'}
              </h4>

              <p className="text-sm dark:text-neutral-300 mt-2">
                {resource.content.length > 150
                  ? `${resource.content.substring(0, 150)}...`
                  : resource.content}
              </p>
            </div>
          )}
          {resource.sourceType === 'LINK' ? (
            // Layout para Links
            <div className="space-y-2">
              <h4 className="font-medium text-base mb-1 dark:text-white">
                {resource.content.split('\n')[0].replace(/^#\s+/, '') ||
                  'Conteúdo de Link'}
              </h4>

              <p className="text-sm dark:text-neutral-300">
                {resource.content.length > 200
                  ? `${resource.content.substring(0, 200)}...`
                  : resource.content}
              </p>

              <span className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded">
                Link
              </span>
            </div>
          ) : isCuratedChunk && curatedMetadata ? (
            // Layout especial para chunks curados
            <div className="space-y-2">
              <h4 className="font-semibold text-base dark:text-white">
                {curatedMetadata.title || 'Chunk Curado'}
              </h4>

              {curatedMetadata.law && (
                <div className="text-xs">
                  <span className="font-medium text-purple-600 dark:text-purple-400">
                    Lei:
                  </span>
                  <span className="ml-1 text-neutral-600 dark:text-neutral-300">
                    {curatedMetadata.law}
                  </span>
                </div>
              )}

              {curatedMetadata.context && (
                <div className="text-xs">
                  <span className="font-medium text-green-600 dark:text-green-400">
                    Contexto:
                  </span>
                  <span className="ml-1 text-neutral-600 dark:text-neutral-300">
                    {curatedMetadata.context}
                  </span>
                </div>
              )}

              {curatedMetadata.source && (
                <div className="text-xs">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Fonte:
                  </span>
                  <span className="ml-1 text-neutral-600 dark:text-neutral-300">
                    <a 
                      href={curatedMetadata.source} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {curatedMetadata.source.length > 50 
                        ? `${curatedMetadata.source.substring(0, 50)}...` 
                        : curatedMetadata.source}
                    </a>
                  </span>
                </div>
              )}

              <p className="text-sm dark:text-neutral-300 mt-2">
                {curatedMetadata.content && curatedMetadata.content.length > 150
                  ? `${curatedMetadata.content.substring(0, 150)}...`
                  : curatedMetadata.content}
              </p>

              <div className="flex flex-wrap gap-2 mt-2">
                <span className="inline-block bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs px-2 py-1 rounded">
                  🔍 Curado
                </span>
                {curatedMetadata.session && (
                  <span className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs px-2 py-1 rounded">
                    {curatedMetadata.session.replace('curador-', 'Sessão-')}
                  </span>
                )}
              </div>
            </div>
          ) : resource.sourceType === 'PDF' ? (
            // Layout para PDFs
            <div className="space-y-2">
              <h4 className="font-medium text-base mb-1 dark:text-white">
                {resource.content.split('\n')[0].replace(/^#\s+/, '') ||
                  'Conteúdo de PDF'}
              </h4>

              <p className="text-sm dark:text-neutral-300">
                {resource.content.length > 200
                  ? `${resource.content.substring(0, 200)}...`
                  : resource.content}
              </p>

              <span className="inline-block bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs px-2 py-1 rounded">
                PDF
              </span>
            </div>
          ) : (
            // Layout padrão para outros tipos de recursos
            <div className="space-y-2">
              <p className="text-sm dark:text-neutral-300">
                {resource.content.length > 200
                  ? `${resource.content.substring(0, 200)}...`
                  : resource.content}
              </p>
            </div>
          )}

          <div className="flex justify-between items-center mt-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Adicionado em:{' '}
              {new Date(resource.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div className="flex items-center space-x-2">
              {isManualChunk && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                  Manual
                </span>
              )}
              <p className="text-xs text-blue-500">{resourceTokens} tokens</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col space-y-2">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(resource)}
              className="ml-4 self-start"
            >
              Editar
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(resource.id)}
            className="ml-4 self-start"
          >
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
};
