import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { PartnersModule } from './partners/partners.module';
import { MilestonesModule } from './milestones/milestones.module';
import { RewardsModule } from './rewards/rewards.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid('development', 'staging', 'production', 'test')
          .default('development'),
        SUPABASE_URL: Joi.string().uri().required(),
        SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
        AWS_REGION: Joi.string().required(),
        AWS_S3_BUCKET: Joi.string().required(),
        // Opcionales: en App Runner el SDK toma credenciales del instance
        // role (ver infra/terraform/iam.tf) sin necesitar access keys; en
        // local/Railway siguen viniendo del .env.
        AWS_ACCESS_KEY_ID: Joi.string().optional(),
        AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
        AWS_SES_FROM_EMAIL: Joi.string().email().required(),
      }),
    }),
    SupabaseModule,
    AuthModule,
    PartnersModule,
    MilestonesModule,
    RewardsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
