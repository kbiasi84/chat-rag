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
import { toast } from 'sonner';
import { SourceType } from '@/lib/db/schema/resources';
import { nanoid } from '@/lib/utils';
import {
  countTokens,
  truncateToTokenLimit,
} from '@/lib/ai/utils/token-counter';

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
  const [activeTab, setActiveTab] = useState<'manual' | 'link'>('manual');
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

    // Separar recursos manuais (que têm sourceId começando com 'manual-')
    const manualData = textData.filter((resource) =>
      resource.sourceId?.startsWith('manual-'),
    );

    setLinkResources(linkData);
    setManualResources(manualData);

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
    const newContent = e.target.value;
    const count = countTokens(newContent);

    if (count <= MAX_MANUAL_CHUNK_TOKENS) {
      setManualChunk(newContent);
    } else {
      const truncatedContent = truncateToTokenLimit(
        newContent,
        MAX_MANUAL_CHUNK_TOKENS,
      );
      setManualChunk(truncatedContent);
      toast.info(`Limite de ${MAX_MANUAL_CHUNK_TOKENS} tokens atingido`);
    }
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
          ) : (
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
          )}
        </div>

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

  // Extrair metadados do chunk manual
  const extractManualMetadata = (content: string) => {
    const lines = content.split('\n');
    const metadata: { [key: string]: string } = {};
    let contentStart = 0;

    // Extrair título
    if (lines[0]?.startsWith('# ')) {
      metadata.title = lines[0].replace('# ', '');
      contentStart = 2; // Pular título e linha vazia
    }

    // Extrair outros metadados
    const contentLines = [];
    let foundContent = false;

    for (let i = contentStart; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('**Lei:**')) {
        metadata.law = line.replace('**Lei:**', '').trim();
      } else if (line.startsWith('**Hierarquia:**')) {
        metadata.hierarchy = line.replace('**Hierarquia:**', '').trim();
      } else if (line.startsWith('**Contexto:**')) {
        metadata.context = line.replace('**Contexto:**', '').trim();
      } else if (line.startsWith('**Categoria:**')) {
        metadata.category = line.replace('**Categoria:**', '').trim();
      } else if (line.startsWith('**Tags:**')) {
        metadata.tags = line.replace('**Tags:**', '').trim();
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

  const manualMetadata = isManualChunk
    ? extractManualMetadata(resource.content)
    : null;

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
      <div className="flex justify-between">
        <div className="flex-1">
          {isManualChunk && manualMetadata ? (
            // Layout especial para chunks manuais
            <div className="space-y-2">
              <h4 className="font-semibold text-base dark:text-white">
                {manualMetadata.title || 'Chunk Manual'}
              </h4>

              {manualMetadata.law && (
                <div className="text-xs">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Lei:
                  </span>
                  <span className="ml-1 text-neutral-600 dark:text-neutral-300">
                    {manualMetadata.law}
                  </span>
                </div>
              )}

              {manualMetadata.hierarchy && (
                <div className="text-xs">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Hierarquia:
                  </span>
                  <span className="ml-1 text-neutral-600 dark:text-neutral-300">
                    {manualMetadata.hierarchy}
                  </span>
                </div>
              )}

              {manualMetadata.context && (
                <div className="text-xs">
                  <span className="font-medium text-green-600 dark:text-green-400">
                    Contexto:
                  </span>
                  <span className="ml-1 text-neutral-600 dark:text-neutral-300">
                    {manualMetadata.context}
                  </span>
                </div>
              )}

              <p className="text-sm dark:text-neutral-300 mt-2">
                {manualMetadata.content && manualMetadata.content.length > 150
                  ? `${manualMetadata.content.substring(0, 150)}...`
                  : manualMetadata.content}
              </p>

              <div className="flex flex-wrap gap-2 mt-2">
                {manualMetadata.category && (
                  <span className="inline-block bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs px-2 py-1 rounded">
                    {manualMetadata.category}
                  </span>
                )}
                {manualMetadata.tags?.split(',').map((tag, idx) => (
                  <span
                    key={`tag-${resource.id}-${tag.trim()}`}
                    className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs px-2 py-1 rounded"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          ) : resource.sourceType === 'LINK' ? (
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
