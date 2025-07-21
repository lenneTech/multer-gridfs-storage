import type {SinonSandbox} from 'sinon';
import type {GridFsStorage} from '../../src';

export interface FileRemovalContext {
	storage?: InstanceType<typeof GridFsStorage>;
	sandbox?: SinonSandbox;
}
