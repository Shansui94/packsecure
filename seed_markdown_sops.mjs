import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Simple YAML Frontmatter parser
 */
function parseFrontmatter(fileContent) {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = fileContent.match(frontmatterRegex);

    if (!match) {
        return { data: {}, content: fileContent };
    }

    const yamlBlock = match[1];
    const bodyContent = match[2];
    const data = {};

    yamlBlock.split(/\r?\n/).forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();

            // Handle array [A, B, C]
            if (value.startsWith('[') && value.endsWith(']')) {
                data[key] = value
                    .slice(1, -1)
                    .split(',')
                    .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
                    .filter(Boolean);
            } else {
                // Remove quotes
                data[key] = value.replace(/^['"]|['"]$/g, '');
            }
        }
    });

    return { data, content: bodyContent };
}

async function run() {
    console.log("🚀 Starting Dynamic SOP Markdown Sync...");

    const sopsDir = path.join(__dirname, 'docs', 'sops');
    if (!fs.existsSync(sopsDir)) {
        console.error(`SOP directory not found at: ${sopsDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(sopsDir).filter(f => f.endsWith('.md'));
    console.log(`📁 Found ${files.length} SOP markdown files in docs/sops:`, files);

    const articles = [];

    files.forEach((file, index) => {
        const filePath = path.join(sopsDir, file);
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = parseFrontmatter(rawContent);

        // Derive title
        let title = data.title;
        if (!title) {
            const h1Match = rawContent.match(/^#\s+(.+)$/m);
            title = h1Match ? h1Match[1].trim() : file.replace(/\.md$/, '');
        }

        // Derive roles
        const roles = data.applicable_roles || data.target_roles || ['SuperAdmin', 'Admin', 'Manager'];

        // Derive page_id
        let pageId = data.page_id || '';
        if (!pageId) {
            if (file.toLowerCase().includes('driver')) pageId = 'driver-delivery';
            else if (file.toLowerCase().includes('leave')) pageId = 'leave-calendar';
            else if (file.toLowerCase().includes('machine')) pageId = 'scanner';
            else pageId = file.toLowerCase().replace(/\.md$/, '').replace(/[^a-z0-9]/g, '-');
        }

        // Derive description
        let description = data.description || '';
        if (!description) {
            const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('>'));
            description = lines[0] ? lines[0].slice(0, 120) : `${title} 标准作业指导书`;
        }

        articles.push({
            title,
            description,
            content: rawContent, // Keep complete markdown including header
            page_id: pageId,
            target_roles: roles,
            sort_order: parseInt(data.sort_order, 10) || (index + 1),
            is_published: true,
            created_by: 'System Seed'
        });
    });

    // 1. Clean existing seeded articles
    console.log("🧹 Cleaning previously seeded SOP articles...");
    const { error: deleteError } = await supabase
        .from('sop_articles')
        .delete()
        .eq('created_by', 'System Seed');

    if (deleteError) {
        console.error("⚠️ Failed to clean seeded articles, trying fallback delete:", deleteError.message);
        // Fallback: delete all if created_by isn't filtered
        await supabase
            .from('sop_articles')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // 2. Insert new articles
    console.log(`📥 Inserting ${articles.length} parsed SOP articles into Supabase...`);
    const { data: inserted, error: insertError } = await supabase
        .from('sop_articles')
        .insert(articles)
        .select('id, title, page_id, sort_order');

    if (insertError) {
        console.error("❌ Failed to insert SOP articles:", insertError);
        process.exit(1);
    }

    console.log("\n✅ Successfully synced SOP Articles to database:");
    inserted.forEach(item => {
        console.log(`  - [Order ${item.sort_order}] ${item.title} (page: ${item.page_id}, id: ${item.id})`);
    });
}

run();
