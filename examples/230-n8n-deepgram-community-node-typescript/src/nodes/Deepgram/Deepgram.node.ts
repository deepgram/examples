import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { DeepgramClient } from '@deepgram/sdk';

export class Deepgram implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Deepgram',
		name: 'deepgram',
		icon: 'file:deepgram.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the Deepgram API for speech-to-text, text-to-speech, and audio intelligence',
		defaults: {
			name: 'Deepgram',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'deepgramApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Transcription',
						value: 'transcription',
					},
					{
						name: 'Text-to-Speech',
						value: 'tts',
					},
					{
						name: 'Audio Intelligence',
						value: 'intelligence',
					},
				],
				default: 'transcription',
			},

			// ── Transcription operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['transcription'] } },
				options: [
					{
						name: 'Transcribe URL',
						value: 'transcribeUrl',
						action: 'Transcribe audio from a URL',
						description: 'Transcribe audio from a publicly accessible URL',
					},
					{
						name: 'Transcribe File',
						value: 'transcribeFile',
						action: 'Transcribe an audio file',
						description: 'Transcribe audio from binary input data',
					},
				],
				default: 'transcribeUrl',
			},
			{
				displayName: 'Audio URL',
				name: 'audioUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['transcription'], operation: ['transcribeUrl'] } },
				description: 'URL of the audio file to transcribe',
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryField',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: { show: { resource: ['transcription'], operation: ['transcribeFile'] } },
				description: 'Name of the binary property containing the audio file',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				displayOptions: { show: { resource: ['transcription'] } },
				options: [
					{ name: 'Nova-3 (General)', value: 'nova-3' },
					{ name: 'Nova-3 Phone Call', value: 'nova-3-phonecall' },
					{ name: 'Nova-3 Medical', value: 'nova-3-medical' },
					{ name: 'Nova-2 (General)', value: 'nova-2' },
				],
				default: 'nova-3',
				description: 'Deepgram transcription model to use',
			},
			{
				displayName: 'Smart Format',
				name: 'smartFormat',
				type: 'boolean',
				displayOptions: { show: { resource: ['transcription'] } },
				default: true,
				description: 'Whether to add punctuation, capitalization, and paragraph formatting',
			},
			{
				displayName: 'Diarize',
				name: 'diarize',
				type: 'boolean',
				displayOptions: { show: { resource: ['transcription'] } },
				default: false,
				description: 'Whether to identify different speakers in the audio',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				displayOptions: { show: { resource: ['transcription'] } },
				default: '',
				description: 'BCP-47 language code (e.g. "en", "es", "fr"). Leave empty for auto-detect.',
			},

			// ── TTS operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['tts'] } },
				options: [
					{
						name: 'Speak',
						value: 'speak',
						action: 'Convert text to speech',
						description: 'Convert text to audio using Deepgram Aura TTS',
					},
				],
				default: 'speak',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['tts'] } },
				description: 'Text to convert to speech',
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'options',
				displayOptions: { show: { resource: ['tts'] } },
				options: [
					{ name: 'Aura 2 Thalia (Female, English)', value: 'aura-2-thalia-en' },
					{ name: 'Aura 2 Helena (Female, English)', value: 'aura-2-helena-en' },
					{ name: 'Aura 2 Andromeda (Female, English)', value: 'aura-2-andromeda-en' },
					{ name: 'Aura 2 Orpheus (Male, English)', value: 'aura-2-orpheus-en' },
					{ name: 'Aura 2 Arcas (Male, English)', value: 'aura-2-arcas-en' },
					{ name: 'Aura 2 Perseus (Male, English)', value: 'aura-2-perseus-en' },
				],
				default: 'aura-2-thalia-en',
				description: 'Voice model to use for speech synthesis',
			},
			{
				displayName: 'Output Binary Field',
				name: 'outputBinaryField',
				type: 'string',
				displayOptions: { show: { resource: ['tts'] } },
				default: 'data',
				description: 'Name of the binary property to store the audio output',
			},

			// ── Audio Intelligence operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['intelligence'] } },
				options: [
					{
						name: 'Analyze',
						value: 'analyze',
						action: 'Analyze audio with intelligence features',
						description: 'Transcribe and analyze audio with summarization, topic detection, or sentiment analysis',
					},
				],
				default: 'analyze',
			},
			{
				displayName: 'Audio URL',
				name: 'intelligenceAudioUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['intelligence'] } },
				description: 'URL of the audio file to analyze',
			},
			{
				displayName: 'Summarize',
				name: 'summarize',
				type: 'boolean',
				displayOptions: { show: { resource: ['intelligence'] } },
				default: true,
				description: 'Whether to generate a summary of the audio content',
			},
			{
				displayName: 'Detect Topics',
				name: 'detectTopics',
				type: 'boolean',
				displayOptions: { show: { resource: ['intelligence'] } },
				default: false,
				description: 'Whether to detect topics discussed in the audio',
			},
			{
				displayName: 'Sentiment Analysis',
				name: 'sentimentAnalysis',
				type: 'boolean',
				displayOptions: { show: { resource: ['intelligence'] } },
				default: false,
				description: 'Whether to perform sentiment analysis on the audio',
			},
			{
				displayName: 'Intents',
				name: 'intents',
				type: 'boolean',
				displayOptions: { show: { resource: ['intelligence'] } },
				default: false,
				description: 'Whether to detect intents in the audio',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('deepgramApi');
		const client = new DeepgramClient({ apiKey: credentials.apiKey as string });

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'transcription') {
					const result = await handleTranscription.call(this, client, i, operation);
					returnData.push({ json: result as unknown as IDataObject });
				} else if (resource === 'tts') {
					const result = await handleTts.call(this, client, i);
					returnData.push(result);
				} else if (resource === 'intelligence') {
					const result = await handleIntelligence.call(this, client, i);
					returnData.push({ json: result as unknown as IDataObject });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function handleTranscription(
	this: IExecuteFunctions,
	client: InstanceType<typeof DeepgramClient>,
	itemIndex: number,
	operation: string,
): Promise<IDataObject> {
	const model = this.getNodeParameter('model', itemIndex) as string;
	const smartFormat = this.getNodeParameter('smartFormat', itemIndex) as boolean;
	const diarize = this.getNodeParameter('diarize', itemIndex) as boolean;
	const language = this.getNodeParameter('language', itemIndex, '') as string;

	const options: IDataObject = {
		model,
		smart_format: smartFormat,
		diarize,
		tag: 'deepgram-examples',
	};
	if (language) options.language = language;

	if (operation === 'transcribeUrl') {
		const audioUrl = this.getNodeParameter('audioUrl', itemIndex) as string;
		// SDK v5: flat options object with url included
		return (await client.listen.v1.media.transcribeUrl({
			url: audioUrl,
			...options,
		})) as unknown as IDataObject;
	}

	const binaryField = this.getNodeParameter('binaryField', itemIndex) as string;
	const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryField);
	// SDK v5: transcribeFile takes buffer and flat options
	return (await client.listen.v1.media.transcribeFile(buffer, {
		...options,
	})) as unknown as IDataObject;
}

async function handleTts(
	this: IExecuteFunctions,
	client: InstanceType<typeof DeepgramClient>,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const text = this.getNodeParameter('text', itemIndex) as string;
	const voice = this.getNodeParameter('voice', itemIndex) as string;
	const outputField = this.getNodeParameter('outputBinaryField', itemIndex, 'data') as string;

	// SDK v5: speak.v1.audio.generate() returns BinaryResponse
	const response = await client.speak.v1.audio.generate({
		text,
		model: voice,
		tag: 'deepgram-examples',
	});

	const audioBuffer = Buffer.from(await response.arrayBuffer());

	const binaryData = await this.helpers.prepareBinaryData(
		audioBuffer,
		'speech.mp3',
		'audio/mpeg',
	);

	return {
		json: { success: true, voice, textLength: text.length },
		binary: { [outputField]: binaryData },
	};
}

async function handleIntelligence(
	this: IExecuteFunctions,
	client: InstanceType<typeof DeepgramClient>,
	itemIndex: number,
): Promise<IDataObject> {
	const audioUrl = this.getNodeParameter('intelligenceAudioUrl', itemIndex) as string;
	const summarize = this.getNodeParameter('summarize', itemIndex) as boolean;
	const detectTopics = this.getNodeParameter('detectTopics', itemIndex) as boolean;
	const sentimentAnalysis = this.getNodeParameter('sentimentAnalysis', itemIndex) as boolean;
	const intents = this.getNodeParameter('intents', itemIndex) as boolean;

	const options: IDataObject = {
		model: 'nova-3',
		smart_format: true,
		tag: 'deepgram-examples',
	};
	if (summarize) options.summarize = 'v2';
	if (detectTopics) options.topics = true;
	if (sentimentAnalysis) options.sentiment = true;
	if (intents) options.intents = true;

	// SDK v5: intelligence features are query params on pre-recorded transcription
	return (await client.listen.v1.media.transcribeUrl({
		url: audioUrl,
		...options,
	})) as unknown as IDataObject;
}
