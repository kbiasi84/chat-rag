'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  createResource,
  getAllResources,
  deleteResource,
  getResourcesBySourceType,
} from '@/lib/actions/resources';
import {
  createLink,
  getAllLinks,
  deleteLink,
  refreshLink,
} from '@/lib/actions/links';
import { toast } from 'sonner';
import { uploadPdf } from '@/lib/actions/pdf';
import { SourceType } from '@/lib/db/schema/resources';
import { nanoid } from '@/lib/utils';

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
interface Link {
  id: string;
  url: string;
  title: string;
  description: string | null;
  lastProcessed: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Senha simples para proteção de acesso
const ADMIN_PASSWORD = 'admin123';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'text' | 'pdf' | 'link'>('text');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Estados para gerenciamento de links
  const [links, setLinks] = useState<Link[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [isRefreshingLink, setIsRefreshingLink] = useState<string | null>(null);

  // Sobrescrevendo o estado de recursos para ter recursos por tipo
  const [textResources, setTextResources] = useState<Resource[]>([]);
  const [linkResources, setLinkResources] = useState<Resource[]>([]);
  const [pdfResources, setPdfResources] = useState<Resource[]>([]);

  // Tentar verificar autenticação no localStorage
  useEffect(() => {
    const authStatus = localStorage.getItem('admin-auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      loadResourcesByType();
      loadLinks();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadResourcesByType = async () => {
    setIsLoading(true);

    // Buscar recursos por tipo
    const textData = await getResourcesBySourceType(SourceType.TEXT);
    const linkData = await getResourcesBySourceType(SourceType.LINK);
    const pdfData = await getResourcesBySourceType(SourceType.PDF);

    setTextResources(textData);
    setLinkResources(linkData);
    setPdfResources(pdfData);

    setIsLoading(false);
  };

  const loadLinks = async () => {
    const data = await getAllLinks();
    setLinks(data);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('admin-auth', 'true');
      loadResourcesByType();
      loadLinks();
    } else {
      toast.error('Senha incorreta');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin-auth');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('O conteúdo não pode estar vazio');
      return;
    }

    setIsSubmitting(true);
    try {
      // Adiciona título se existir
      const fullContent = title.trim() ? `# ${title}\n\n${content}` : content;

      // Gerar um ID único para o conteúdo de texto, assim como é feito para PDFs
      const textId = nanoid();

      const result = await createResource({
        content: fullContent,
        sourceType: SourceType.TEXT,
        sourceId: textId,
      });

      if (typeof result === 'string' && result.includes('successfully')) {
        toast.success('Conteúdo adicionado com sucesso');
        setContent('');
        setTitle('');
        loadResourcesByType();
      } else {
        toast.error('Erro ao adicionar conteúdo');
      }
    } catch (error) {
      console.error(error);
      toast.error('Ocorreu um erro ao processar sua solicitação');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      toast.error('Selecione um arquivo PDF para upload');
      return;
    }

    // Verificar tamanho do arquivo (limitar a 10MB)
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (pdfFile.size > maxSizeInBytes) {
      toast.error(
        `O arquivo é muito grande. O tamanho máximo permitido é 10MB.`,
      );
      return;
    }

    setIsUploadingPdf(true);
    const toastId = toast.loading(
      'Processando PDF, isso pode levar alguns segundos...',
    );

    try {
      const formData = new FormData();
      formData.append('file', pdfFile);

      // Usar Server Action diretamente em vez de API Route
      const result = await uploadPdf(formData);

      toast.dismiss(toastId);

      if (result.success) {
        toast.success(result.message);
        setPdfFile(null);

        // Limpar o input file
        const fileInput = document.getElementById(
          'pdf-file',
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        loadResourcesByType();
      } else {
        toast.error(result.message || 'Erro ao processar o PDF');
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error('Erro no upload do PDF:', error);
      toast.error('Ocorreu um erro ao fazer upload do PDF');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Verificar se o arquivo é realmente um PDF antes de definir o estado
      if (
        !file.type.includes('pdf') &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {
        toast.error('O arquivo selecionado não parece ser um PDF válido');
        // Limpar o input
        e.target.value = '';
        return;
      }

      setPdfFile(file);
    } else {
      setPdfFile(null);
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
      const result = await createLink({
        url: linkUrl,
        title: linkTitle,
        description: linkDescription || null,
      });

      toast.success('Link adicionado com sucesso');
      setLinkUrl('');
      setLinkTitle('');
      setLinkDescription('');
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

  // Tela de login
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <div className="w-full max-w-md p-8 bg-white dark:bg-neutral-800 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-center text-neutral-800 dark:text-white">
            Área Administrativa
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2 dark:text-neutral-200"
              >
                Senha
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Digite a senha de administrador"
              />
            </div>
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 pb-10">
      <header className="bg-white dark:bg-neutral-800 shadow-sm sticky top-14 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-neutral-800 dark:text-white">
            Administração de Conteúdo
          </h1>
          <Button variant="outline" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-medium mb-4 dark:text-white">
            Adicionar Novo Conteúdo
          </h2>

          {/* Abas para escolher o tipo de conteúdo */}
          <div className="flex border-b mb-6">
            <button
              type="button"
              className={`px-4 py-2 font-medium ${
                activeTab === 'text'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
              onClick={() => setActiveTab('text')}
            >
              Texto
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
              Arquivo PDF
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

          {activeTab === 'text' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium mb-2 dark:text-neutral-200"
                >
                  Título (opcional)
                </label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título do documento, legislação ou contrato"
                />
              </div>
              <div>
                <label
                  htmlFor="content"
                  className="block text-sm font-medium mb-2 dark:text-neutral-200"
                >
                  Conteúdo
                </label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  placeholder="Insira o texto do documento, legislação, modelo de contrato ou qualquer outro conteúdo para a base de conhecimento"
                  required
                />
                <p className="text-xs text-gray-500 mt-1 dark:text-neutral-400">
                  Para melhor processamento, insira textos completos e bem
                  formatados.
                </p>
              </div>
              <Button type="submit" disabled={isSubmitting || !content.trim()}>
                {isSubmitting
                  ? 'Processando...'
                  : 'Adicionar à Base de Conhecimento'}
              </Button>
            </form>
          ) : activeTab === 'pdf' ? (
            <form onSubmit={handlePdfUpload} className="space-y-4">
              <div>
                <label
                  htmlFor="pdf-file"
                  className="block text-sm font-medium mb-2 dark:text-neutral-200"
                >
                  Arquivo PDF
                </label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="pdf-file"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfFileChange}
                    className="flex-1"
                    required
                  />
                </div>
                {pdfFile && (
                  <p className="text-sm text-green-600 mt-2">
                    Arquivo selecionado: {pdfFile.name} (
                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1 dark:text-neutral-400">
                  Upload de arquivos PDF para extração automática de texto.
                  Tamanho máximo: 10MB.
                </p>
              </div>
              <Button type="submit" disabled={isUploadingPdf || !pdfFile}>
                {isUploadingPdf
                  ? 'Processando...'
                  : 'Processar PDF e Adicionar'}
              </Button>
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
              {activeTab === 'text' && (
                <>
                  <h3 className="text-md font-medium mb-3 dark:text-neutral-300">
                    Conteúdos Adicionados via Texto
                  </h3>
                  {textResources.length === 0 ? (
                    <p className="text-center py-6 text-neutral-500 dark:text-neutral-400">
                      Nenhum conteúdo de texto adicionado.
                    </p>
                  ) : (
                    <div className="space-y-4 mb-8">
                      {textResources.map((resource) => (
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
                        <div
                          key={resource.id}
                          className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4"
                        >
                          <div className="flex justify-between">
                            <div className="flex-1">
                              {/* Extrair o título do conteúdo (primeira linha com #) */}
                              <h4 className="font-medium text-base mb-1">
                                {resource.content
                                  .split('\n')[0]
                                  .replace(/^#\s+/, '')}
                              </h4>

                              {/* Mostrar metadados do PDF */}
                              <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                                {resource.content
                                  .split('\n')
                                  .slice(2, 5)
                                  .map((line, idx) => (
                                    <div key={`${resource.id}-meta-${idx}`}>
                                      {line}
                                    </div>
                                  ))}
                              </div>

                              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                Adicionado em:{' '}
                                {new Date(
                                  resource.createdAt,
                                ).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(resource.id)}
                              className="ml-4 self-start"
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
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
                          hideDelete={true}
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
  hideDelete = false,
}: {
  resource: Resource;
  onDelete: (id: string) => void;
  hideDelete?: boolean;
}) => {
  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
      <div className="flex justify-between">
        <div className="flex-1">
          <p className="text-sm dark:text-neutral-300">
            {resource.content.length > 200
              ? `${resource.content.substring(0, 200)}...`
              : resource.content}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
            Adicionado em:{' '}
            {new Date(resource.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {!hideDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(resource.id)}
            className="ml-4 self-start"
          >
            Excluir
          </Button>
        )}
      </div>
    </div>
  );
};
