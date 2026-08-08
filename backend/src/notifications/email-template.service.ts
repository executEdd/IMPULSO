import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "fs";
import { join } from "path";

export interface EmailTemplateData {
  title: string;
  message: string;
  preheader?: string;
  logo?: string;
  buttonText?: string;
  buttonUrl?: string;
  extraInformation?: string;
  year?: string;
}

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);
  private readonly template: string;
  private readonly defaultLogoUrl: string;

  constructor(private config: ConfigService) {
    const templatePath = join(
      process.cwd(),
      "assets",
      "templates",
      "email-template.html",
    );
    this.template = readFileSync(templatePath, "utf8");
    this.defaultLogoUrl =
      this.config.get<string>("EMAIL_LOGO_URL") ||
      "https://via.placeholder.com/160x160/7a1f1f/ffffff?text=CBTIS+61";
  }

  render(data: EmailTemplateData): string {
    const year = data.year ?? new Date().getFullYear().toString();
    const preheader =
      data.preheader ?? data.message.replace(/<[^>]*>/g, "").substring(0, 120);
    const logo = data.logo ?? this.defaultLogoUrl;

    const buttonBlock = this.buildButtonBlock(data.buttonText, data.buttonUrl);
    const extraInformationBlock = this.buildExtraInformationBlock(
      data.extraInformation,
    );

    return this.template
      .replace(/\{\{title\}\}/g, this.escapeHtml(data.title))
      .replace(/\{\{message\}\}/g, data.message)
      .replace(/\{\{preheader\}\}/g, this.escapeHtml(preheader))
      .replace(/\{\{logo\}\}/g, this.escapeHtml(logo))
      .replace(/\{\{button_block\}\}/g, buttonBlock)
      .replace(/\{\{extra_information_block\}\}/g, extraInformationBlock)
      .replace(/\{\{year\}\}/g, year);
  }

  private buildButtonBlock(buttonText?: string, buttonUrl?: string): string {
    if (!buttonText || !buttonUrl) {
      return "";
    }

    const escapedText = this.escapeHtml(buttonText);
    const escapedUrl = this.escapeHtml(buttonUrl);

    return `
      <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 28px auto;">
        <tr>
          <td style="border-radius: 8px; background-color: #7a1f1f; text-align: center;">
            <a href="${escapedUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 8px;">
              ${escapedText}
            </a>
          </td>
        </tr>
      </table>
    `;
  }

  private buildExtraInformationBlock(extraInformation?: string): string {
    if (!extraInformation) {
      return "";
    }

    return `
      <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="margin-bottom: 28px; background-color: #fafafa; border-radius: 8px; border-left: 4px solid #c9a227;">
        <tr>
          <td style="padding: 20px 24px; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 15px; line-height: 24px; color: #4a4a4a;">
            ${extraInformation}
          </td>
        </tr>
      </table>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
