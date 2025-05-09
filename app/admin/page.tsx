'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Database, UserPlus, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getAllUsers, updateUserRole, type UserWithCreatedAt } from './actions';

export default function AdminPage() {
  const [users, setUsers] = useState<UserWithCreatedAt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const userData = await getAllUsers();
      setUsers(userData);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Falha ao carregar a lista de usuários');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRole = async (userId: string, isAdmin: boolean) => {
    setUpdatingUserId(userId);
    try {
      const newRole = isAdmin ? 'usuario' : 'admin';
      const result = await updateUserRole(userId, newRole);

      if (result.success) {
        toast.success(result.message);
        // Atualizar o perfil do usuário na lista local para evitar nova consulta
        setUsers(
          users.map((user) =>
            user.id === userId ? { ...user, perfil: newRole } : user,
          ),
        );
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Não foi possível atualizar o perfil do usuário');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 pb-10">
      <header className="bg-white dark:bg-neutral-800 shadow-sm">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <h1 className="text-xl font-semibold text-neutral-800 dark:text-white">
            Painel de Administração
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 py-8">
        {/* Banner de links rápidos */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-medium mb-4 dark:text-white">
            Gerenciamento
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link href="/admin/base-conhecimento">
              <Button className="flex items-center gap-2">
                <Database className="size-4" />
                Base de Conhecimento
              </Button>
            </Link>
            {/* Adicione mais botões de gerenciamento conforme necessário */}
          </div>
        </div>

        {/* Lista de usuários */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium dark:text-white">
              Usuários do Sistema
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={loadUsers}
              disabled={isLoading}
            >
              Atualizar
            </Button>
          </div>

          {isLoading ? (
            <p className="text-center py-10 text-neutral-500 dark:text-neutral-400">
              Carregando usuários...
            </p>
          ) : users.length === 0 ? (
            <p className="text-center py-6 text-neutral-500 dark:text-neutral-400">
              Nenhum usuário encontrado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-100 dark:bg-neutral-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Nome</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Whatsapp</th>
                    <th className="px-4 py-2 text-left">Perfil</th>
                    <th className="px-4 py-2 text-left">Data de Cadastro</th>
                    <th className="px-4 py-2 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isAdmin = user.perfil === 'admin';
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-neutral-200 dark:border-neutral-700"
                      >
                        <td className="px-4 py-3">{user.nome || 'N/A'}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">{user.whatsapp || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              isAdmin
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}
                          >
                            {isAdmin ? 'Admin' : 'Usuário'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {new Date(user.criadoEm).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                            disabled={updatingUserId === user.id}
                            onClick={() => handleChangeRole(user.id, isAdmin)}
                          >
                            {isAdmin ? (
                              <>
                                <UserPlus className="size-3" />
                                Rebaixar
                              </>
                            ) : (
                              <>
                                <UserCheck className="size-3" />
                                Promover
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
