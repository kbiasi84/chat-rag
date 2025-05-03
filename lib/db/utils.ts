import { genSaltSync, hashSync } from 'bcrypt-ts';

/**
 * Gera um hash seguro para uma senha
 * @param password Senha em texto puro
 * @returns Hash da senha
 */
export function generateHashedPassword(password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  return hash;
}
