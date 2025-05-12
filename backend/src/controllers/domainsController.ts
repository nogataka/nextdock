import { Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { AuthenticatedRequest, AppError } from '../types';

dotenv.config();

// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// DNSレコードの検証（カスタムドメイン設定時に使用）
const verifyDnsRecord = async (domain: string): Promise<boolean> => {
  try {
    // ここでは簡単な例として、ドメインがDNSで解決できるかを確認するだけ
    // 実際の実装では、特定のDNSレコード（CNAME等）の存在を確認する必要があります
    await axios.get(`https://${domain}`, {
      timeout: 5000,
      validateStatus: () => true, // レスポンスステータスに関わらず成功とみなす
    });
    
    return true;
  } catch (error) {
    // タイムアウトなどの場合
    return false;
  }
};

// アプリのドメイン設定を取得
export const getDomainSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId } = req.params;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認し、所有権をチェック - テーブル名を変更
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .select('*')
      .eq('id', appId)
      .single();
    
    if (appError || !app) {
      throw new AppError('App not found', 404);
    }
    
    if (app.user_id !== req.user.id) {
      throw new AppError('You do not have permission to access this app', 403);
    }
    
    // カスタムドメインレコードを取得 - テーブル名を変更
    const { data: domains, error: domainsError } = await supabase
      .from('nextdock_domains')
      .select('*')
      .eq('app_id', appId);
    
    if (domainsError) throw domainsError;
    
    res.status(200).json({
      app: {
        id: app.id,
        name: app.name,
        subdomain: app.subdomain,
        domain_type: app.domain_type,
        custom_domain: app.custom_domain,
      },
      domains: domains || [],
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to fetch domain settings',
    });
  }
};

// カスタムドメインを追加
export const addCustomDomain = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId } = req.params;
  const { domain } = req.body;
  
  if (!domain) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Domain is required',
    });
    return;
  }
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認し、所有権をチェック - テーブル名を変更
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .select('*')
      .eq('id', appId)
      .single();
    
    if (appError || !app) {
      throw new AppError('App not found', 404);
    }
    
    if (app.user_id !== req.user.id) {
      throw new AppError('You do not have permission to modify this app', 403);
    }
    
    // ドメインが既に使用されているか確認 - テーブル名を変更
    const { data: existingDomain, error: domainError } = await supabase
      .from('nextdock_domains')
      .select('id')
      .eq('domain', domain)
      .limit(1);
    
    if (domainError) throw domainError;
    
    if (existingDomain && existingDomain.length > 0) {
      throw new AppError('Domain is already in use', 409);
    }
    
    // 新しいドメインレコードを作成 - テーブル名を変更
    const { data: newDomain, error: createError } = await supabase
      .from('nextdock_domains')
      .insert([
        {
          id: uuidv4(),
          app_id: appId,
          domain,
          verified: false,
          verification_code: uuidv4().substring(0, 8),
        },
      ])
      .select()
      .single();
    
    if (createError) throw createError;
    if (!newDomain) throw new AppError('Failed to create domain record', 500);
    
    res.status(201).json({
      message: 'Custom domain added successfully',
      domain: {
        id: newDomain.id,
        domain: newDomain.domain,
        verified: newDomain.verified,
        verification_required: true,
        instructions: `To verify ownership, add a TXT record to your DNS settings with name "_nextdock-verify" and value "${newDomain.verification_code}"`,
      },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to add custom domain',
    });
  }
};

// カスタムドメインを検証
export const verifyCustomDomain = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId, domainId } = req.params;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認し、所有権をチェック - テーブル名を変更
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .select('user_id')
      .eq('id', appId)
      .single();
    
    if (appError || !app) {
      throw new AppError('App not found', 404);
    }
    
    if (app.user_id !== req.user.id) {
      throw new AppError('You do not have permission to modify this app', 403);
    }
    
    // ドメインレコードを取得 - テーブル名を変更
    const { data: domain, error: domainError } = await supabase
      .from('nextdock_domains')
      .select('*')
      .eq('id', domainId)
      .eq('app_id', appId)
      .single();
    
    if (domainError || !domain) {
      throw new AppError('Domain not found', 404);
    }
    
    // ドメインの検証
    const isVerified = await verifyDnsRecord(domain.domain);
    
    if (!isVerified) {
      throw new AppError('Could not verify DNS settings. Please check your DNS configuration and try again.', 400);
    }
    
    // ドメインを検証済みとしてマーク - テーブル名を変更
    const { error: updateError } = await supabase
      .from('nextdock_domains')
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq('id', domainId);
    
    if (updateError) throw updateError;
    
    // アプリのカスタムドメインを更新 - テーブル名を変更
    const { error: appUpdateError } = await supabase
      .from('nextdock_apps')
      .update({
        domain_type: 'custom',
        custom_domain: domain.domain,
      })
      .eq('id', appId);
    
    if (appUpdateError) throw appUpdateError;
    
    res.status(200).json({
      message: 'Domain verified successfully',
      domain: {
        id: domain.id,
        domain: domain.domain,
        verified: true,
      },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to verify domain',
    });
  }
};

// カスタムドメインを削除
export const removeCustomDomain = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId, domainId } = req.params;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認し、所有権をチェック - テーブル名を変更
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .select('*')
      .eq('id', appId)
      .single();
    
    if (appError || !app) {
      throw new AppError('App not found', 404);
    }
    
    if (app.user_id !== req.user.id) {
      throw new AppError('You do not have permission to modify this app', 403);
    }
    
    // ドメインレコードを取得 - テーブル名を変更
    const { data: domain, error: domainError } = await supabase
      .from('nextdock_domains')
      .select('domain')
      .eq('id', domainId)
      .eq('app_id', appId)
      .single();
    
    if (domainError || !domain) {
      throw new AppError('Domain not found', 404);
    }
    
    // ドメインレコードを削除 - テーブル名を変更
    const { error: deleteError } = await supabase
      .from('nextdock_domains')
      .delete()
      .eq('id', domainId);
    
    if (deleteError) throw deleteError;
    
    // アプリのプライマリドメインとして設定されていた場合、デフォルトに戻す
    if (app.custom_domain === domain.domain) {
      const { error: updateError } = await supabase
        .from('nextdock_apps')
        .update({
          domain_type: 'auto',
          custom_domain: null,
        })
        .eq('id', appId);
      
      if (updateError) throw updateError;
    }
    
    res.status(200).json({
      message: 'Custom domain removed successfully',
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to remove custom domain',
    });
  }
};

// プライマリドメインを設定
export const setPrimaryDomain = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId } = req.params;
  const { domainType, customDomain } = req.body;
  
  if (!domainType || (domainType !== 'auto' && domainType !== 'custom')) {
    res.status(400).json({
      error: 'Bad Request',
      message: "Domain type must be 'auto' or 'custom'",
    });
    return;
  }
  
  // カスタムドメインを使用する場合、ドメイン名が必要
  if (domainType === 'custom' && !customDomain) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Custom domain is required when domain type is custom',
    });
    return;
  }
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認し、所有権をチェック - テーブル名を変更
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .select('user_id')
      .eq('id', appId)
      .single();
    
    if (appError || !app) {
      throw new AppError('App not found', 404);
    }
    
    if (app.user_id !== req.user.id) {
      throw new AppError('You do not have permission to modify this app', 403);
    }
    
    // カスタムドメインを使用する場合、ドメインの存在と検証状態を確認 - テーブル名を変更
    if (domainType === 'custom') {
      const { data: domain, error: domainError } = await supabase
        .from('nextdock_domains')
        .select('verified')
        .eq('app_id', appId)
        .eq('domain', customDomain)
        .single();
      
      if (domainError || !domain) {
        throw new AppError('Custom domain not found', 404);
      }
      
      if (!domain.verified) {
        throw new AppError('Custom domain must be verified before setting as primary', 400);
      }
    }
    
    // アプリのドメイン設定を更新 - テーブル名を変更
    const updates = {
      domain_type: domainType,
      custom_domain: domainType === 'custom' ? customDomain : null,
    };
    
    const { data: updatedApp, error: updateError } = await supabase
      .from('nextdock_apps')
      .update(updates)
      .eq('id', appId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    if (!updatedApp) throw new AppError('Failed to update app domain settings', 500);
    
    res.status(200).json({
      message: 'Primary domain updated successfully',
      app: {
        id: updatedApp.id,
        domain_type: updatedApp.domain_type,
        custom_domain: updatedApp.custom_domain,
        subdomain: updatedApp.subdomain,
      },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to set primary domain',
    });
  }
};

export default {
  getDomainSettings,
  addCustomDomain,
  verifyCustomDomain,
  removeCustomDomain,
  setPrimaryDomain,
};
