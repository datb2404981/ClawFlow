import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { TransformInterceptor } from './common/interceptor/transform.interceptor';
import { json, urlencoded, type RequestHandler } from 'express';
import cookieParserDefault from 'cookie-parser';

/** `cookie-parser` dùng `export =`; với `nodenext` default import đôi khi không gán được kiểu → ESLint báo unsafe call. */
type CookieParserFactory = (
  secret?: string | string[],
) => RequestHandler;
const cookieParser: CookieParserFactory =
  cookieParserDefault as unknown as CookieParserFactory;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const port = Number(config.get('PORT') ?? config.get('POST') ?? 8080);

  /** Mặc định Express chỉ 100KB — workspace có logo/brand base64 cần lớn hơn. */
  const jsonBodyLimit = config.get<string>('HTTP_JSON_LIMIT') ?? '2mb';
  app.use(json({ limit: jsonBodyLimit }));
  app.use(urlencoded({ limit: jsonBodyLimit, extended: true }));

  app.use(cookieParser());

  app.enableCors({
    origin: true, // Allow all origins temporarily to debug, or keep specific ['http://localhost:5173']
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));

  await app.listen(port ?? 8080);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
