/**
 * Ghi thẳng skill template hệ thống (is_system) vào DB qua Nest — không cần Postman / ADMIN_SEED_KEY.
 * Cần MONGO_URI trong Backend/.env (cùng môi trường khi chạy `start:dev`).
 *
 * - Seed bộ 4 prompt ClawFlow có sẵn:  npm run seed:system-skills:clawflow-builtin
 * - Seed từ file JSON:              npm run seed:system-skills -- /đường/dẫn/file.json
 * - Mặc định:                       scripts/seed/definitions.json (sao chép từ definitions.example.json)
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { SkillTemplatesService } from 'src/module/ai-center/service/skill-templates.service';
import type { AdminSeedSkillTemplateDto } from 'src/module/ai-center/dto/admin-seed-skill-template.dto';
import { clawflowBuiltinSkillTemplates } from './seed/data/clawflow-builtin-prompts';

const defaultJsonPath = join('scripts', 'seed', 'definitions.json');

async function loadPayload(pathFromArg: string | undefined) {
  const p = pathFromArg ?? defaultJsonPath;
  const text = await readFile(p, 'utf8');
  return JSON.parse(text) as unknown;
}

function assertPayloadList(raw: unknown): AdminSeedSkillTemplateDto[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      'File JSON phải là mảng không rỗng. Sao chép mẫu: cp scripts/seed/definitions.example.json scripts/seed/definitions.json',
    );
  }
  return raw as AdminSeedSkillTemplateDto[];
}

async function run() {
  const pathOrFlag = process.argv[2];
  let list: AdminSeedSkillTemplateDto[];

  if (pathOrFlag === '--clawflow-builtin') {
    list = assertPayloadList(clawflowBuiltinSkillTemplates);
  } else {
    let raw: unknown;
    try {
      raw = await loadPayload(pathOrFlag);
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err?.code === 'ENOENT') {
        // eslint-disable-next-line no-console
        console.error(
          `Chưa có file. Tạo từ mẫu rồi chạy lại:\n  cp scripts/seed/definitions.example.json ${defaultJsonPath}\n` +
            `Hoặc: npm run seed:system-skills:clawflow-builtin  (4 skill ClawFlow có sẵn)\n` +
            `Hoặc: npm run seed:system-skills -- /đường/dẫn/file.json\n`,
        );
      }
      throw e;
    }
    list = assertPayloadList(raw);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const skillTemplates = app.get(SkillTemplatesService);
    for (let i = 0; i < list.length; i++) {
      // eslint-disable-next-line no-console
      console.log(`[${i + 1}/${list.length}] Tạo: ${list[i].name} …`);
      const created = await skillTemplates.adminSeedCreate(list[i]);
      // eslint-disable-next-line no-console
      console.log(created);
    }
    // eslint-disable-next-line no-console
    console.log(`Xong. ${list.length} bản ghi.`);
  } finally {
    await app.close();
  }
}

void run().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
