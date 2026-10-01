import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

function createService(): EmailService {
  const config = {
    getOrThrow: (key: string) =>
      key === 'resend.apiKey' ? 're_test' : 'noreply@example.com',
  } as unknown as ConfigService;
  return new EmailService(config);
}

const params = { to: ['admin@example.com'], subject: 'Assunto', html: '<p/>' };
const rateLimited = {
  data: null,
  error: { name: 'rate_limit_exceeded', message: 'Too many requests' },
};
const ok = { data: { id: 'email_1' }, error: null };

describe('EmailService.send', () => {
  beforeEach(() => {
    mockSend.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries after a rate limit error and succeeds', async () => {
    mockSend.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(ok);

    const result = createService().send(params);
    await jest.runAllTimersAsync();

    await expect(result).resolves.toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('gives up after the max retries when still rate limited', async () => {
    mockSend.mockResolvedValue(rateLimited);

    const result = createService().send(params);
    await jest.runAllTimersAsync();

    await expect(result).resolves.toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(4); // 1 intento + 3 reintentos
  });

  it('does not retry other errors', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { name: 'validation_error', message: 'Invalid `to` field' },
    });

    const result = createService().send(params);
    await jest.runAllTimersAsync();

    await expect(result).resolves.toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('does not call Resend without recipients', async () => {
    await expect(createService().send({ ...params, to: [] })).resolves.toBe(
      false,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });
});
