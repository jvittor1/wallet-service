import * as argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  const hashedPassword = await argon2.hash(password);
  return hashedPassword;
}
