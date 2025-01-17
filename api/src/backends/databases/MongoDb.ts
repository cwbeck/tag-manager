import { inject, injectable } from 'inversify';
import BaseDatabase, {
    AppQueryOptions,
    BaseQueryOptions,
    IngestQueryOptions,
} from './abstractions/BaseDatabase';
import TYPES from '../../container/IOC.types';
import BaseConfig from '../configuration/abstractions/BaseConfig';
import App from '../../mongo/models/tag/App';
import IngestEndpoint from '../../mongo/models/data/IngestEndpoint';
import Shell from '../../mongo/database/Shell';
import GenericError from '../../errors/GenericError';
import { LogPriority } from '../../enums/LogPriority';
import { Collection } from 'mongodb';
import { StorageProvider } from '../../enums/StorageProvider';
import { StorageProviderConfig } from '../../mongo/types/Types';

@injectable()
export default class MongoDb extends BaseDatabase {
    @inject(TYPES.BackendConfig) private readonly config!: BaseConfig;
    @inject(TYPES.Shell) protected readonly shell!: Shell;

    public getStorageProvider(): StorageProvider {
        return StorageProvider.MONGODB;
    }

    public async getStorageProviderConfig(): Promise<StorageProviderConfig> {
        return {
            config: {
                connection_string: '',
                database_name: 's8',
            },
            hint: `S8 Managed Ingest Endpoint`,
        };
    }

    protected readonly MOBILE_TEST: [string, RegExp][] = [
        ['browser_name', /mobile/i],
        ['device_name', /iphone/i],
        ['device_name', /ipad/i],
        ['os_name', /ios/i],
        ['os_name', /android/i],
    ];

    private getAsMobileAggregationRegex() {
        return this.MOBILE_TEST.map(([input, regex]) => {
            return {
                $regexMatch: {
                    input: '$' + input,
                    regex: regex,
                },
            };
        });
    }

    private getAsMobileFilter() {
        return this.MOBILE_TEST.map(([input, regex]) => ({
            [input]: regex,
        }));
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async configure(): Promise<void> {}

    protected getCollection(entity: App | IngestEndpoint): Promise<Collection> {
        if (entity.usageIngestEndpointEnvironmentId === undefined) {
            throw new GenericError(
                `Unable to find usage endpoint for ${
                    entity.constructor.name
                }: ${entity.id.toString()}`,
                LogPriority.ERROR,
            );
        } else {
            return this.shell.getCollection(
                `s8_${entity.usageIngestEndpointEnvironmentId.toString()}`,
            );
        }
    }

    private async runAggregation(
        entity: App | IngestEndpoint,
        pipeline: { [k: string]: any }[],
        limit?: number,
    ): Promise<any[]> {
        try {
            const collection = await this.getCollection(entity);
            const aggregation = collection.aggregate(pipeline);
            if (limit !== undefined) {
                aggregation.limit(limit);
            }
            return await aggregation.toArray();
        } catch (e) {
            console.error(e);
            console.debug(JSON.stringify(pipeline));
            return [];
        }
    }

    protected getFormatForTimeSlice(options: BaseQueryOptions): string {
        switch (options.time_slice) {
            case 'YEAR':
                return '%Y';
            case 'MONTH':
                return '%Y-%m';
            case 'DAY':
                return '%Y-%m-%d';
            case 'HOUR':
                return '%Y-%m-%d %H:00:00';
            case 'MINUTE':
                return '%Y-%m-%d %H:%M:00';
        }
        throw new GenericError(
            `Unsupported time slice ${options.time_slice}`,
            LogPriority.DEBUG,
            true,
        );
    }

    protected static getFilterObjectFromStringFilterOption(
        queryOptions: AppQueryOptions,
        filterOptionKey: keyof AppQueryOptions['filter_options'],
        filterKey: string,
    ): { [filterKey: string]: any } | undefined {
        return typeof queryOptions.filter_options[filterOptionKey] === 'string'
            ? {
                  [filterKey]: queryOptions.filter_options[filterOptionKey],
              }
            : undefined;
    }

    protected getAppFilter(queryOptions: AppQueryOptions): { [p: string]: any } {
        const getRange = () => {
            return {
                dt: {
                    $gte: this.getRangeFromAsDate(queryOptions),
                    $lt: this.getRangeToAsDate(queryOptions),
                },
            };
        };
        const getRevisionFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'revision', 'revision_id');
        const getEnvironmentFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(
                queryOptions,
                'environment',
                'environment_id',
            );
        const getEventFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'event', 'event');
        const getEventGroupFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(
                queryOptions,
                'event_group',
                'event_group',
            );
        const getUTMSourceFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'utm_source', 'utm_source');
        const getUTMMediumFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'utm_medium', 'utm_medium');
        const getUTMCampaignFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(
                queryOptions,
                'utm_campaign',
                'utm_campaign',
            );
        const getUTMTermFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'utm_term', 'utm_term');
        const getUTMContentFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(
                queryOptions,
                'utm_content',
                'utm_content',
            );
        const getCountry = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'country', 'user_country');
        const getReferrer = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'referrer', 'referrer_url');
        const getReferrerTld = () =>
            MongoDb.getFilterObjectFromStringFilterOption(
                queryOptions,
                'referrer_tld',
                'referrer_url',
            );
        const getPage = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'page', 'page_url');
        const getMobile = () => {
            if (typeof queryOptions.filter_options.mobile === 'boolean') {
                return queryOptions.filter_options.mobile
                    ? {
                          $or: this.getAsMobileFilter(),
                      }
                    : {
                          $nor: this.getAsMobileFilter(),
                      };
            } else {
                return undefined;
            }
        };
        const getBrowser = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'browser', 'browser_name');
        const getOS = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'os', 'os_name');
        return [
            getRange(),
            getRevisionFilter(),
            getEnvironmentFilter(),
            getEventFilter(),
            getEventGroupFilter(),
            getUTMSourceFilter(),
            getUTMMediumFilter(),
            getUTMCampaignFilter(),
            getUTMTermFilter(),
            getUTMContentFilter(),
            getCountry(),
            getPage(),
            getReferrer(),
            getReferrerTld(),
            getMobile(),
            getBrowser(),
            getOS(),
        ].reduce((a, c) => {
            return c === undefined ? a : Object.assign(a, c);
        }, {} as { [k: string]: any }) as { [p: string]: any };
    }

    public async simpleAppAggregation(
        app: App,
        queryOptions: AppQueryOptions,
        key: string,
        checkExists = false,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        const getMatch = () => {
            const match = this.getAppFilter(queryOptions);
            if (checkExists) {
                match[key] = { $exists: true };
            }
            return match;
        };

        const rows = await this.runAggregation(
            app,
            [
                {
                    $match: getMatch(),
                },
                {
                    $project: {
                        _id: 0,
                        key: '$' + key,
                        user_hash: 1,
                    },
                },
                {
                    $group: {
                        _id: {
                            key: '$key',
                            user_hash: '$user_hash',
                        },
                        event_count: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: '$_id.key',
                        user_count: { $sum: 1 },
                        event_count: { $sum: '$event_count' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        key: '$_id',
                        user_count: 1,
                        event_count: 1,
                    },
                },
                {
                    $sort: { user_count: -1 },
                },
            ],
            queryOptions.limit,
        );

        return this.getResultWithRange(queryOptions, rows);
    }

    public async averageSessionDuration(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{ result: number; from: Date; to: Date }> {
        const rows = await this.runAggregation(app, [
            {
                $match: this.getAppFilter(queryOptions),
            },
            {
                $project: {
                    ts: { $convert: { input: '$dt', to: 'decimal' } },
                    _id: 0,
                    user_hash: 1,
                },
            },
            {
                $group: {
                    _id: '$user_hash',
                    max: { $min: '$ts' },
                    min: { $max: '$ts' },
                },
            },
            {
                $addFields: {
                    diff: { $subtract: ['$max', '$min'] },
                },
            },
            {
                $match: {
                    diff: { $gt: 0 },
                },
            },
            {
                $group: {
                    _id: null,
                    avg: { $avg: '$diff' },
                },
            },
        ]);

        return this.getResultWithRange(
            queryOptions,
            rows.length > 0 ? Math.round(rows[0]['avg']) : 0,
        );
    }

    public async bounceRatio(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{ result: number; from: Date; to: Date }> {
        const rows = await this.runAggregation(app, [
            {
                $match: this.getAppFilter(queryOptions),
            },
            {
                $project: {
                    _id: 0,
                    user_hash: 1,
                },
            },
            {
                $group: {
                    _id: '$user_hash',
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 1,
                    bounce: { $cond: { if: { $eq: ['$count', 1] }, then: 1, else: 0 } },
                },
            },
            {
                $group: {
                    _id: null,
                    bounce: { $avg: '$bounce' },
                },
            },
        ]);

        return this.getResultWithRange(
            queryOptions,
            rows.length > 0 ? Math.round(rows[0]['bounce']) : 0,
        );
    }

    public async eventRequests(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        const rows = await this.runAggregation(
            app,
            [
                {
                    $match: this.getAppFilter(queryOptions),
                },
                {
                    $project: {
                        _id: 0,
                        key: {
                            $dateToString: {
                                format: this.getFormatForTimeSlice(queryOptions),
                                date: '$dt',
                            },
                        },
                        user_hash: 1,
                    },
                },
                {
                    $group: {
                        _id: {
                            key: '$key',
                            user_hash: '$user_hash',
                        },
                        event_count: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: '$_id.key',
                        user_count: { $sum: 1 },
                        event_count: { $sum: '$event_count' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        key: '$_id',
                        user_count: 1,
                        event_count: 1,
                    },
                },
                {
                    $sort: { user_count: -1 },
                },
            ],
            queryOptions.limit,
        );

        return this.getResultWithRange(queryOptions, rows);
    }

    public async referrers(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        const rows = await this.runAggregation(
            app,
            [
                {
                    $match: { ...this.getAppFilter(queryOptions), referrer_url: { $exists: true } },
                },
                {
                    $project: {
                        _id: 0,
                        dt: 1,
                        referrer_url: 1,
                        user_hash: 1,
                    },
                },
                {
                    $sort: {
                        dt: -1,
                    },
                },
                {
                    $group: {
                        _id: '$user_hash',
                        referrer: { $first: '$referrer_url' },
                        event_count: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: '$referrer',
                        user_count: { $sum: 1 },
                        event_count: { $sum: '$event_count' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        key: '$_id',
                        user_count: 1,
                        event_count: 1,
                    },
                },
                {
                    $sort: { user_count: -1 },
                },
            ],
            queryOptions.limit,
        );

        return this.getResultWithRange(queryOptions, rows);
    }

    public async referrerTlds(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        const rows = await this.runAggregation(
            app,
            [
                {
                    $match: { ...this.getAppFilter(queryOptions), referrer_url: { $exists: true } },
                },
                {
                    $project: {
                        _id: 0,
                        dt: 1,
                        referrer_url_match: {
                            $regexFind: { input: '$referrer_url', regex: /https?:\/\/([^/]+)/ },
                        },
                        user_hash: 1,
                    },
                },
                {
                    $match: { referrer_url_match: { $ne: null } },
                },
                {
                    $project: {
                        _id: 0,
                        dt: 1,
                        tld: { $arrayElemAt: ['$referrer_url_match.captures', 0] },
                        user_hash: 1,
                    },
                },
                {
                    $sort: {
                        dt: -1,
                    },
                },
                {
                    $group: {
                        _id: '$user_hash',
                        tld: { $first: '$tld' },
                        event_count: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: '$tld',
                        user_count: { $sum: 1 },
                        event_count: { $sum: '$event_count' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        key: '$_id',
                        user_count: 1,
                        event_count: 1,
                    },
                },
                {
                    $sort: { user_count: -1 },
                },
            ],
            queryOptions.limit,
        );

        return this.getResultWithRange(queryOptions, rows);
    }

    public async utms(
        app: App,
        queryOptions: AppQueryOptions,
        utmFilter: 'MEDIUM' | 'SOURCE' | 'CAMPAIGN',
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        const getUTMKey = () => {
            if (utmFilter === 'MEDIUM') {
                return 'utm_medium';
            } else if (utmFilter === 'SOURCE') {
                return 'utm_source';
            } else if (utmFilter === 'CAMPAIGN') {
                return 'utm_campaign';
            } else {
                throw new GenericError(
                    'UTM filter provided is not currently supported',
                    LogPriority.ERROR,
                );
            }
        };
        return this.simpleAppAggregation(app, queryOptions, getUTMKey(), true);
    }

    public async pages(
        app: App,
        queryOptions: AppQueryOptions,
        pageFilter?: 'ENTRY' | 'EXIT',
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        const getPipeline = () => {
            if (pageFilter === undefined) {
                return [
                    {
                        $match: { ...this.getAppFilter(queryOptions), page_url: { $exists: true } },
                    },
                    {
                        $project: {
                            _id: 0,
                            dt: 1,
                            page_url: 1,
                            user_hash: 1,
                        },
                    },
                    {
                        $sort: {
                            dt: -1,
                        },
                    },
                    {
                        $group: {
                            _id: {
                                key: '$page_url',
                                user_hash: '$user_hash',
                            },
                            event_count: { $sum: 1 },
                        },
                    },
                    {
                        $group: {
                            _id: '$_id.key',
                            user_count: { $sum: 1 },
                            event_count: { $sum: '$event_count' },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            key: '$_id',
                            user_count: 1,
                            event_count: 1,
                        },
                    },
                    {
                        $sort: { user_count: -1 },
                    },
                ];
            } else {
                return [
                    {
                        $match: { ...this.getAppFilter(queryOptions), page_url: { $exists: true } },
                    },
                    {
                        $project: {
                            _id: 0,
                            dt: 1,
                            page_url: 1,
                            user_hash: 1,
                        },
                    },
                    {
                        $sort: {
                            dt: -1,
                        },
                    },
                    {
                        $group: {
                            _id: '$user_hash',
                            page_url:
                                pageFilter === 'ENTRY'
                                    ? { $first: '$page_url' }
                                    : { $last: '$page_url' },
                            event_count: { $sum: 1 },
                        },
                    },
                    {
                        $group: {
                            _id: '$page_url',
                            user_count: { $sum: 1 },
                            event_count: { $sum: '$event_count' },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            key: '$_id',
                            user_count: 1,
                            event_count: 1,
                        },
                    },
                    {
                        $sort: { user_count: -1 },
                    },
                ];
            }
        };

        const rows = await this.runAggregation(app, getPipeline(), queryOptions.limit);

        return this.getResultWithRange(queryOptions, rows);
    }

    public async countries(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        return this.simpleAppAggregation(app, queryOptions, 'user_country', true);
    }

    public async devices(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        const rows = await this.runAggregation(
            app,
            [
                {
                    $match: { ...this.getAppFilter(queryOptions) },
                },
                {
                    $project: {
                        _id: 0,
                        key: {
                            $cond: {
                                if: { $or: this.getAsMobileAggregationRegex() },
                                then: 'Mobile',
                                else: 'Desktop',
                            },
                        },
                        user_hash: 1,
                    },
                },
                {
                    $group: {
                        _id: {
                            key: '$key',
                            user_hash: '$user_hash',
                        },
                        event_count: { $sum: 1 },
                    },
                },
                {
                    $group: {
                        _id: '$_id.key',
                        user_count: { $sum: 1 },
                        event_count: { $sum: '$event_count' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        key: '$_id',
                        user_count: 1,
                        event_count: 1,
                    },
                },
                {
                    $sort: { user_count: -1 },
                },
            ],
            queryOptions.limit,
        );

        return this.getResultWithRange(queryOptions, rows);
    }

    public async eventGroups(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        return this.simpleAppAggregation(app, queryOptions, 'event_group', true);
    }

    public async events(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        return this.simpleAppAggregation(app, queryOptions, 'event');
    }

    public async browsers(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        return this.simpleAppAggregation(app, queryOptions, 'browser_name');
    }

    public async operatingSystems(
        app: App,
        queryOptions: AppQueryOptions,
    ): Promise<{
        result: { key: string; user_count: number; event_count: number }[];
        from: Date;
        to: Date;
    }> {
        return this.simpleAppAggregation(app, queryOptions, 'os_name');
    }

    protected getIngestEndpointFilter(queryOptions: AppQueryOptions): { [p: string]: any } {
        const getRange = () => {
            return {
                dt: {
                    $gte: this.getRangeFromAsDate(queryOptions),
                    $lt: this.getRangeToAsDate(queryOptions),
                },
            };
        };
        const getRevisionFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(queryOptions, 'revision', 'revision_id');
        const getEnvironmentFilter = () =>
            MongoDb.getFilterObjectFromStringFilterOption(
                queryOptions,
                'environment',
                'environment_id',
            );

        return [getRange(), getRevisionFilter(), getEnvironmentFilter()].reduce((a, c) => {
            return c === undefined ? a : Object.assign(a, c);
        }, {} as { [k: string]: any }) as { [p: string]: any };
    }

    public async usage(
        ingestEndpoint: IngestEndpoint,
        queryOptions: IngestQueryOptions,
    ): Promise<{
        result: { key: string; requests: number; bytes: number }[];
        from: Date;
        to: Date;
    }> {
        const rows = await this.runAggregation(
            ingestEndpoint,
            [
                {
                    $match: this.getIngestEndpointFilter(queryOptions),
                },
                {
                    $project: {
                        _id: 0,
                        key: {
                            $dateToString: {
                                format: this.getFormatForTimeSlice(queryOptions),
                                date: '$dt',
                            },
                        },
                        requests: 1,
                        bytes: 1,
                    },
                },
                {
                    $group: {
                        _id: '$key',
                        requests: { $sum: '$requests' },
                        bytes: { $sum: '$bytes' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        key: '$_id',
                        requests: 1,
                        bytes: 1,
                    },
                },
                {
                    $sort: { key: -1 },
                },
            ],
            queryOptions.limit,
        );

        return this.getResultWithRange(queryOptions, rows);
    }

    public async simpleIngestSum(
        ingestEndpoint: IngestEndpoint,
        queryOptions: IngestQueryOptions,
        key: string,
    ): Promise<{ result: { key: string; count: number }[]; from: Date; to: Date }> {
        const rows = await this.runAggregation(
            ingestEndpoint,
            [
                {
                    $match: this.getIngestEndpointFilter(queryOptions),
                },
                {
                    $project: {
                        _id: 0,
                        key: {
                            $dateToString: {
                                format: this.getFormatForTimeSlice(queryOptions),
                                date: '$dt',
                            },
                        },
                        count: '$' + key,
                    },
                },
                {
                    $group: {
                        _id: '$key',
                        count: { $sum: '$count' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        key: '$_id',
                        count: 1,
                    },
                },
                {
                    $sort: { key: -1 },
                },
            ],
            queryOptions.limit,
        );

        return this.getResultWithRange(queryOptions, rows);
    }

    public async requests(
        ingestEndpoint: IngestEndpoint,
        queryOptions: IngestQueryOptions,
    ): Promise<{ result: { key: string; count: number }[]; from: Date; to: Date }> {
        return this.simpleIngestSum(ingestEndpoint, queryOptions, 'requests');
    }

    public async bytes(
        ingestEndpoint: IngestEndpoint,
        queryOptions: IngestQueryOptions,
    ): Promise<{ result: { key: string; count: number }[]; from: Date; to: Date }> {
        return this.simpleIngestSum(ingestEndpoint, queryOptions, 'bytes');
    }
}
