import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DeepgramApi implements ICredentialType {
	name = 'deepgramApi';

	displayName = 'Deepgram API';

	documentationUrl = 'https://developers.deepgram.com/docs/authenticating';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Token {{$credentials?.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.deepgram.com',
			url: '/v1/projects',
			method: 'GET',
		},
	};
}
