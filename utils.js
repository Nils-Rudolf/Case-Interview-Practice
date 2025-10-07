// utils.js
class SchemaValidator {
    constructor(schema) {
        this.schema = schema;
    }

    validate(data) {
        const errors = [];
        
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            this.validateObject(parsed, this.schema, '', errors);
            
            // Check for unique case IDs
            if (parsed.cases && Array.isArray(parsed.cases)) {
                const ids = parsed.cases.map(c => c.id);
                const uniqueIds = new Set(ids);
                if (ids.length !== uniqueIds.size) {
                    errors.push({
                        path: 'cases',
                        message: 'Duplicate case IDs found'
                    });
                }
            }
            
            return { valid: errors.length === 0, errors, data: parsed };
        } catch (e) {
            errors.push({
                path: '',
                message: `JSON parse error: ${e.message}`
            });
            return { valid: false, errors };
        }
    }

    validateObject(data, schema, path, errors) {
        if (schema.$ref) {
            const refPath = schema.$ref.split('/');
            let refSchema = this.schema;
            for (let i = 1; i < refPath.length; i++) {
                refSchema = refSchema[refPath[i]];
            }
            return this.validateObject(data, refSchema, path, errors);
        }

        if (schema.type === 'object') {
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                errors.push({ path, message: 'Expected object' });
                return;
            }

            if (schema.required) {
                for (const req of schema.required) {
                    if (!(req in data)) {
                        errors.push({ path: path ? `${path}.${req}` : req, message: 'Required field missing' });
                    }
                }
            }

            if (schema.properties) {
                for (const prop in data) {
                    const propPath = path ? `${path}.${prop}` : prop;
                    if (schema.properties[prop]) {
                        this.validateObject(data[prop], schema.properties[prop], propPath, errors);
                    } else if (schema.additionalProperties === false) {
                        errors.push({ path: propPath, message: 'Additional property not allowed' });
                    }
                }
            }
        } else if (schema.type === 'array') {
            if (!Array.isArray(data)) {
                errors.push({ path, message: 'Expected array' });
                return;
            }

            if (schema.minItems !== undefined && data.length < schema.minItems) {
                errors.push({ path, message: `Array must have at least ${schema.minItems} items` });
            }

            if (schema.maxItems !== undefined && data.length > schema.maxItems) {
                errors.push({ path, message: `Array must have at most ${schema.maxItems} items` });
            }

            if (schema.items) {
                data.forEach((item, index) => {
                    this.validateObject(item, schema.items, `${path}[${index}]`, errors);
                });
            }
        } else if (schema.type === 'string') {
            if (typeof data !== 'string') {
                errors.push({ path, message: 'Expected string' });
                return;
            }

            if (schema.minLength !== undefined && data.length < schema.minLength) {
                errors.push({ path, message: `String must be at least ${schema.minLength} characters` });
            }

            if (schema.maxLength !== undefined && data.length > schema.maxLength) {
                errors.push({ path, message: `String must be at most ${schema.maxLength} characters` });
            }

            if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
                errors.push({ path, message: `String does not match pattern: ${schema.pattern}` });
            }

            if (schema.enum && !schema.enum.includes(data)) {
                errors.push({ path, message: `Value must be one of: ${schema.enum.join(', ')}` });
            }

            if (schema.format === 'date-time' && isNaN(Date.parse(data))) {
                errors.push({ path, message: 'Invalid date-time format' });
            }
        } else if (schema.type === 'integer') {
            if (!Number.isInteger(data)) {
                errors.push({ path, message: 'Expected integer' });
                return;
            }

            if (schema.minimum !== undefined && data < schema.minimum) {
                errors.push({ path, message: `Value must be at least ${schema.minimum}` });
            }

            if (schema.maximum !== undefined && data > schema.maximum) {
                errors.push({ path, message: `Value must be at most ${schema.maximum}` });
            }
        }

        if (schema.const !== undefined && data !== schema.const) {
            errors.push({ path, message: `Value must be exactly: ${schema.const}` });
        }
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function createTreeHTML(nodes) {
    if (!nodes || nodes.length === 0) return '';
    
    return nodes.map(node => {
        let html = `<div class="tree-node">${escapeHtml(node.label)}`;
        if (node.children && node.children.length > 0) {
            html += `<div class="tree-children">${createTreeHTML(node.children)}</div>`;
        }
        html += '</div>';
        return html;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}