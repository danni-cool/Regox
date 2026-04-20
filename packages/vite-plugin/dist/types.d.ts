export interface RegoxConfig {
    build?: {
        outDir?: string;
        ssg?: {
            output?: 'embed' | 'external';
        };
    };
    routing?: {
        apiPrefix?: string;
        notFound?: '404' | 'csr-shell';
    };
    dev?: {
        port?: number;
        goPort?: number;
        proxy?: Record<string, unknown>;
    };
    openapi?: {
        spec?: string;
        generateTypes?: boolean;
        mocksDir?: string;
    };
    export?: {
        ssgDir?: string;
    };
}
export interface PageMeta {
    filePath: string;
    route: string;
    mode: 'ssr' | 'isr' | 'ssg' | 'csr';
    revalidate?: number;
    pageName: string;
    dataType: string | null;
    templPath: string;
    propsPath: string;
}
export type IslandMap = Map<string, IslandMeta>;
export interface IslandMeta {
    componentName: string;
    filePath: string;
    props: SerializableProp[];
    reason: string[];
}
export interface SerializableProp {
    name: string;
    type: string;
    expression: 'literal' | 'field-access' | 'call-expression' | 'array' | 'unsupported';
    value: string;
}
export interface CompileOptions {
    pageName: string;
    goPackage?: string;
    goImport?: string;
    filePath?: string;
}
