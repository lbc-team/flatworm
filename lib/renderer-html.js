"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const document_1 = require("./document");
const markdown_1 = require("./markdown");
const renderer_1 = require("./renderer");
const PageHeader = `<!DOCTYPE html>
<html>
  <head>
    <title><!--TITLE--></title>
    <link rel="stylesheet" type="text/css" href="/static/style.css">
  </head>
  <body>
    <div class="sidebar">
      <div class="header">
        <div class="logo"><a href="/"><div class="image"></div><div class="name"><!--BANNER_TITLE--></div><div class="version"><!--BANNER_SUBTITLE--></div></a></div>
      </div>
      <div class="toc"><div>
        <!--SIDEBAR-->
      </div></div>
    </div>
    <div class="content">
      <div class="breadcrumbs"><!--BREADCRUMBS--></div>
`;
const PageFooter = `
      <div class="footer">
        <div class="nav previous"><!--PREV_LINK--></div>
        <div class="nav next"><!--NEXT_LINK--></div>
      </div>
      <div class="copyright"><!--COPYRIGHT--></div>
    </div>
    <script src="/static/script.js" type="text/javascript"></script>
  </body>
</html>
`;
const Tags = {};
Tags[markdown_1.ElementStyle.BOLD] = "b";
Tags[markdown_1.ElementStyle.CODE] = "code";
Tags[markdown_1.ElementStyle.ITALIC] = "i";
Tags[markdown_1.ElementStyle.SUPER] = "sup";
Tags[markdown_1.ElementStyle.UNDERLINE] = "u";
const DOT = '<span class="symbol">.</span>';
function escapeHtml(html) {
    return html.replace(/(&([a-zA-Z0-9]+;)|<|>)/g, (all, token, entity) => {
        if (entity) {
            return token;
        }
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[token];
    });
}
function getTag(name, classes) {
    return `<${name} class="${classes.join(" ")}">`;
}
class HtmlRenderer extends renderer_1.Renderer {
    constructor(filename) {
        super(filename || "index.html");
    }
    renderNode(node) {
        if (node instanceof markdown_1.TextNode) {
            return escapeHtml(node.content);
        }
        else if (node instanceof markdown_1.LinkNode) {
            let url = node.link;
            let name = url;
            if (node.link.indexOf(":") === -1) {
                url = node.document.getLinkUrl(node.link);
                name = node.document.getLinkName(node.link);
            }
            if (node.children.length === 0) {
                return `<a href="${url}">${name}</a>`;
            }
            return `<a href="${url}">${this.renderMarkdown(node.children)}</a>`;
        }
        else if (node instanceof markdown_1.PropertyNode) {
            const result = [];
            // The "new" modifier (optional)
            if (node.isConstructor) {
                result.push(`<span class="modifier">new </span>`);
            }
            // The property name; the final name will be bold
            {
                const nameComps = node.name.split(".");
                let name = `<span class="method">${nameComps.pop()}</span>`;
                if (nameComps.length) {
                    name = nameComps.map((n) => (`<span class="path">${n}</span>`)).join(DOT) + DOT + name;
                }
                result.push(name);
            }
            // The property parameters (optional)
            if (node.parameters) {
                let params = node.parameters.replace(/([a-z0-9_]+)(?:=([^,\)]))?/ig, (all, key, defaultValue) => {
                    let param = `<span class="param">${key}</span>`;
                    if (defaultValue) {
                        param += ` = <span class="default-value">${defaultValue}</span>`;
                    }
                    return param;
                });
                params = params.replace(/([,\]\[\)\(])/g, (all, symbol) => {
                    return `<span class="symbol">${symbol}</span>`;
                });
                result.push(params);
            }
            // The return type (optional)
            if (node.returns) {
                result.push(` <span class="arrow">&rArr;</span> `);
                result.push(`<span class="returns">${this.renderMarkdown(node.returns)}</span>`);
            }
            return result.join("");
        }
        else if (node instanceof markdown_1.ListNode) {
            const result = [];
            result.push(`<ul>`);
            node.items.forEach((item) => {
                result.push(`<li>${this.renderMarkdown(item)}</li>`);
            });
            result.push(`</ul>`);
            return result.join("");
        }
        else if (node instanceof markdown_1.ElementNode) {
            switch (node.style) {
                case markdown_1.ElementStyle.NORMAL:
                    return this.renderMarkdown(node.children);
                case markdown_1.ElementStyle.CODE:
                    return `<code class="inline">${this.renderMarkdown(node.children)}</code>`;
            }
            const tag = Tags[node.style] || "xxx";
            return `<${tag}>${this.renderMarkdown(node.children)}</${tag}>`;
        }
        return `unknown(${node})`;
    }
    renderSidebar(page) {
        const output = [];
        // Get the table of contents for the root page
        const toc = page.document.toc.slice();
        const pageCount = page.path.split("/").length;
        output.push(`<div class="link title"><a href="/">${toc.shift().title}</a></div>`);
        toc.forEach((entry) => {
            let entryCount = entry.path.split("/").length;
            if (entry.path.indexOf("#") >= 0) {
                entryCount++;
            }
            let classes = [];
            // Base node; always added
            if (entryCount === 3) {
                classes.push("base");
            }
            if (entry.path.substring(0, page.path.length) === page.path) {
                if (entryCount === pageCount) {
                    // Myself
                    classes.push("myself");
                    classes.push("ancestor");
                }
                else if (entryCount === pageCount + 1) {
                    // Direct child
                    classes.push("child");
                }
            }
            // Ancestor
            if (classes.indexOf("child") === -1) {
                let basepath = entry.path.split("#")[0];
                if (page.path.substring(0, basepath.length) === basepath) {
                    classes.push("ancestor");
                }
            }
            // A sibling of an ancestor // @TODO: USe the regex instead?
            if (entry.path.indexOf("#") === -1) {
                const comps = entry.path.split("/");
                comps.pop();
                comps.pop();
                comps.push("");
                const path = comps.join("/");
                if (page.path.substring(0, path.length) === path) {
                    classes.push("show");
                }
            }
            if (classes.length === 0) {
                classes.push("hide");
            }
            classes.push("link");
            classes.push("depth-" + entry.depth);
            output.push(`<div class="${classes.join(" ")}"><a href="${entry.path}">${entry.title}</a></div>`);
        });
        return output.join("");
    }
    renderFragment(fragment) {
        const output = [];
        if (fragment.link) {
            output.push(`<a name="${fragment.link}"></a>`);
        }
        if (fragment instanceof document_1.CodeFragment) {
            if (fragment.evaluated) {
                output.push(`<div class="code">`);
                fragment.code.forEach((line) => {
                    let content = escapeHtml(line.content) + "\n";
                    if (line.classes.length) {
                        content = `<span class="${line.classes.join(" ")}">${content}</span>`;
                    }
                    output.push(content);
                });
                output.push(`</div>`);
            }
            else {
                output.push(`<div class="code">${escapeHtml(fragment.source)}</div>`);
            }
            return output.join("");
        }
        else if (fragment instanceof document_1.TocFragment) {
            output.push(`<div class="toc">`);
            fragment.page.toc.slice(1).forEach((entry) => {
                const offset = (entry.depth - 1) * 28;
                output.push(`<div style="padding-left: ${offset}px"><span class="bullet">&bull;</span><a href="${entry.path}">${entry.title}</a></div>`);
            });
            output.push(`</div>`);
            return output.join("");
        }
        switch (fragment.tag) {
            case document_1.FragmentType.SECTION:
            case document_1.FragmentType.SUBSECTION:
            case document_1.FragmentType.HEADING: {
                output.push(`<a name="${fragment.autoLink}"></a>`);
                const tag = ({ section: "h1", subsection: "h2", heading: "h3" })[fragment.tag];
                output.push(`<${tag} class="show-anchors"><div>`);
                output.push(this.renderMarkdown(fragment.title));
                const extInherit = fragment.getExtension("inherit");
                if (extInherit) {
                    const inherit = fragment.page.document.parseMarkdown(extInherit.replace(/\s+/g, " ").trim(), [markdown_1.MarkdownStyle.LINK]);
                    output.push(`<span class="inherits"> inherits ${this.renderMarkdown(inherit)}</span>`);
                }
                else {
                    const extNote = fragment.getExtension("note");
                    if (extNote) {
                        const note = fragment.page.document.parseMarkdown(extNote.replace(/\s+/g, " ").trim(), [markdown_1.MarkdownStyle.LINK]);
                        output.push(`<span class="inherits">${this.renderMarkdown(note)}</span>`);
                    }
                }
                output.push(`<div class="anchors">`);
                if (fragment.link !== "") {
                    output.push(`<a class="self" href="#${fragment.link || fragment.autoLink}"></a>`);
                }
                const extSrc = fragment.getExtension("src");
                if (extSrc) {
                    const srcLink = fragment.page.document.config.getSourceUrl(extSrc, fragment.value);
                    output.push(`<a class="source" href="${srcLink}">source</a>`);
                }
                output.push(`</div>`);
                output.push(`</div></${tag}>`);
                break;
            }
            case document_1.FragmentType.DEFINITION:
            case document_1.FragmentType.NOTE:
            case document_1.FragmentType.WARNING: {
                const classes = ["definition"];
                if (fragment.tag !== "definition") {
                    classes.push("container-box");
                    classes.push(fragment.tag);
                }
                output.push(getTag("div", classes));
                output.push(`<div class="term">`);
                output.push(this.renderMarkdown(fragment.title));
                if (fragment.link) {
                    output.push(`<div class="anchors"><a class="self" href="#${fragment.link}"></a></div>`);
                }
                output.push(`</div>`);
                output.push(`<div class="body">`);
                fragment.body.forEach((block) => {
                    output.push(`<p>${this.renderMarkdown(block)}</p>`);
                });
                output.push(`</div>`);
                output.push(`</div>`);
                break;
            }
            case document_1.FragmentType.PROPERTY: {
                output.push(`<div class="property show-anchors">`);
                output.push(`<div class="signature">`);
                output.push(this.renderMarkdown(fragment.title));
                output.push(`<div class="anchors">`);
                if (fragment.link) {
                    output.push(`<a class="self" href="#${fragment.link}"></a>`);
                }
                const extSrc = fragment.getExtension("src");
                if (extSrc) {
                    const srcLink = fragment.page.document.config.getSourceUrl(extSrc, fragment.value);
                    output.push(`<a class="source" href="${srcLink}">source</a>`);
                }
                output.push(`</div>`);
                output.push(`</div>`);
                output.push(`<div class="body">`);
                fragment.body.forEach((block) => {
                    output.push(`<p>${this.renderMarkdown(block)}</p>`);
                });
                output.push(`</div>`);
                output.push(`</div>`);
                break;
            }
            case document_1.FragmentType.NULL: {
                fragment.body.forEach((block) => {
                    output.push(`<p>${this.renderMarkdown(block)}</p>`);
                });
                break;
            }
            default:
                throw new Error(`unhandled Fragment tag "${fragment.tag}"`);
        }
        return output.join("");
    }
    renderHeader(page, options) {
        if (!options) {
            options = {};
        }
        let header = PageHeader
            .replace("<!--TITLE-->", (page.title || "Documentation"))
            .replace("<!--BANNER_TITLE-->", (page.document.config.title || "TITLE"))
            .replace("<!--BANNER_SUBTITLE-->", (page.document.config.subtitle || "SUBTITLE"))
            .replace("<!--SIDEBAR-->", this.renderSidebar(page));
        if (options.breadcrumbs) {
            const breadcrumbs = [`<span class="current">${page.title}</span>`];
            let path = page.path;
            while (path !== "/") {
                path = path.match(/(.*\/)([^/]+\/)/)[1];
                const p = page.document.getPage(path);
                const title = (p.sectionFragment.getExtension("nav") || p.title);
                breadcrumbs.unshift(`<a href="${p.path}">${title}</a>`);
            }
            header = header.replace("<!--BREADCRUMBS-->", breadcrumbs.join("&nbsp;&nbsp;&raquo;&nbsp;&nbsp;"));
        }
        return header;
    }
    renderFooter(page, options) {
        if (options == null) {
            options = {};
        }
        // Add the copyright to the footer
        let footer = PageFooter.replace("<!--COPYRIGHT-->", this.renderMarkdown(page.document.copyright));
        // Add the next and previous links to the footer
        const navItems = page.document.toc;
        navItems.forEach((entry, index) => {
            if (entry.path === page.path) {
                if (index > 0) {
                    const link = navItems[index - 1];
                    footer = footer.replace("<!--PREV_LINK-->", `<a href="${link.path}"><span class="arrow">&larr;</span>${link.title}</a>`);
                }
                if (index + 1 < navItems.length) {
                    const link = navItems[index + 1];
                    footer = footer.replace("<!--NEXT_LINK-->", `<a href="${link.path}">${link.title}<span class="arrow">&rarr;</span></a>`);
                }
            }
        });
        return footer;
    }
    renderPage(page) {
        const output = [];
        // Add the HTML header
        output.push(this.renderHeader(page, { breadcrumbs: true }));
        output.push(super.renderPage(page));
        // Add the HTML footer
        output.push(this.renderFooter(page, { nudges: true }));
        return output.join("\n");
    }
    renderDocument(document) {
        const files = [];
        // Copy all static files
        [
            "link.svg",
            "lato/index.html",
            "lato/Lato-Italic.ttf",
            "lato/Lato-Black.ttf",
            "lato/Lato-Regular.ttf",
            "lato/Lato-BlackItalic.ttf",
            "lato/OFL.txt",
            "lato/README.txt",
            "script.js",
            "style.css"
        ].forEach((filename) => {
            files.push({
                filename: `static/${filename}`,
                content: fs_1.default.readFileSync(path_1.resolve(__dirname, "../static", filename))
            });
        });
        // Copy over the logo, allowing for a custom override
        if (document.config.logo) {
            files.push({
                filename: "static/logo.svg",
                content: fs_1.default.readFileSync(path_1.resolve(document.basepath, document.config.logo))
            });
        }
        else {
            files.push({
                filename: "static/logo.svg",
                content: fs_1.default.readFileSync(path_1.resolve(__dirname, "../static/logo.svg"))
            });
        }
        super.renderDocument(document).forEach((file) => {
            files.push(file);
        });
        return files;
    }
}
exports.HtmlRenderer = HtmlRenderer;