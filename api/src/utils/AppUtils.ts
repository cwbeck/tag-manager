import Org from '../mongo/models/Org';
import App from '../mongo/models/tag/App';
import User from '../mongo/models/User';
import IngestEndpointEnvironment from '../mongo/models/data/IngestEndpointEnvironment';
import { createUsageEndpointEnvironment } from './IngestEndpointEnvironmentUtils';
import TagManagerAccount from '../mongo/models/tag/TagManagerAccount';
import { ObjectID } from 'mongodb';
import Platform from '../mongo/models/tag/Platform';
import userMessages from '../errors/UserMessages';
import AppPlatform from '../mongo/models/tag/AppPlatform';
import OperationOwner from '../enums/OperationOwner';
import GQLMethod from '../enums/GQLMethod';
import { fetchOrg } from './OrgUtils';
import Revision from '../mongo/models/tag/Revision';
import { createActionGroupDistribution } from './ActionGroupDistributionUtils';
import { createTagSkeleton } from './TagUtils';
import PlatformRevision from '../mongo/models/tag/PlatformRevision';
import AppPlatformRevision from '../mongo/models/tag/AppPlatformRevision';
import { createEnvironment } from './EnvironmentUtils';
import { duplicateRevision } from './RevisionUtils';
import container from '../container/IOC.config';
import RepoFromModelFactory from '../container/factoryTypes/RepoFromModelFactory';
import TYPES from '../container/IOC.types';
import { createGlobalTrigger } from './TriggerUtils';
import { VarType } from '../enums/VarType';
import { ValidationType } from '../../../common/enums/ValidationType';
import { AppType } from '../enums/AppType';
import { ActionGroupDistributionType } from '../enums/ActionGroupDistributionType';
import { SortDirection } from '../enums/SortDirection';
import { TagType } from '../enums/TagType';

const createAppUsageEndpointEnvironment = async (
    org: Org,
    trackingEntity: App,
    actor: User,
): Promise<IngestEndpointEnvironment> => {
    return createUsageEndpointEnvironment(org, trackingEntity, actor, [
        {
            varType: VarType.STRING,
            key: 'uiid',
            defaultValue: '%S8_UIID%',
        },
        {
            varType: VarType.DATETIME,
            key: 'dt',
            defaultValue: '%S8_DATE_TIME_UTC%',
        },
        {
            varType: VarType.STRING,
            key: 'event_group',
            optional: true,
            validations: [
                {
                    type: ValidationType.VALID_REGEX,
                    input_value: '^[a-z]{1,}(-[a-z]+){0,}$',
                },
            ],
        },
        {
            varType: VarType.STRING,
            key: 'event',
            defaultValue: 'page-view',
            validations: [
                {
                    type: ValidationType.VALID_REGEX,
                    input_value: '^[a-z]{1,}(-[a-z]+){0,}$',
                },
            ],
        },
        {
            varType: VarType.STRING,
            key: 'event_json',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'utm_source',
            defaultValue: '%S8_UTM_SOURCE%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'utm_medium',
            defaultValue: '%S8_UTM_MEDIUM%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'utm_campaign',
            defaultValue: '%S8_UTM_CAMPAIGN%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'utm_term',
            defaultValue: '%S8_UTM_TERM%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'utm_content',
            defaultValue: '%S8_UTM_CONTENT%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'user_hash',
            defaultValue: '%S8_USER_HASH%',
        },
        {
            varType: VarType.STRING,
            key: 'user_country',
            defaultValue: '%S8_USER_COUNTRY_CODE%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'org_id',
            defaultValue: '%S8_ORG_ID%',
        },
        {
            varType: VarType.STRING,
            key: 'app_id',
            defaultValue: '%S8_APP_ID%',
        },
        {
            varType: VarType.STRING,
            key: 'env_id',
            defaultValue: '%S8_APP_ENV_ID%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'revision_id',
            defaultValue: '%S8_APP_REVISION_ID%',
        },
        {
            varType: VarType.STRING,
            key: 'page_url',
            defaultValue: '%S8_PAGE_URL%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'page_tld',
            defaultValue: '%S8_PAGE_TLD%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'referrer_url',
            defaultValue: '%S8_REFERRER_URL%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'referrer_tld',
            defaultValue: '%S8_REFERRER_TLD%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'browser_name',
            defaultValue: '%S8_BROWSER_NAME%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'browser_version',
            defaultValue: '%S8_BROWSER_VERSION%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'os_name',
            defaultValue: '%S8_OS_NAME%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'os_version',
            defaultValue: '%S8_OS_VERSION%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'device_name',
            defaultValue: '%S8_DEVICE_NAME%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'device_model',
            defaultValue: '%S8_DEVICE_MODEL%',
            optional: true,
        },
        {
            varType: VarType.STRING,
            key: 'device_brand',
            defaultValue: '%S8_DEVICE_BRAND%',
            optional: true,
        },
    ]);
};

export const createApp = async (
    actor: User,
    tagManagerAccount: TagManagerAccount,
    name: string,
    domain: string,
    type: AppType,
    appId?: ObjectID,
    appRevisionId?: ObjectID,
    appEnvironmentId?: ObjectID,
    appEnvironmentUrl?: string,
): Promise<App> => {
    const repoFactory = container.get<RepoFromModelFactory>(TYPES.RepoFromModelFactory);

    //connect this app with Scale8 core...
    const corePlatform = await repoFactory(Platform).findOneThrows(
        {
            _is_core: true,
        },
        userMessages.platformFailed,
    );

    let app = new App(name, tagManagerAccount, domain, type, [new AppPlatform(corePlatform)]);
    if (appId !== undefined) {
        app['_id'] = appId;
    }
    app = await repoFactory(App).save(app, actor, OperationOwner.USER, {
        gqlMethod: GQLMethod.CREATE,
        forceCreate: appId !== undefined,
    });

    //we need to create an ingest endpoint environment to track usage...
    const usageEndpointEnvironment = await createAppUsageEndpointEnvironment(
        await fetchOrg(tagManagerAccount.orgId),
        app,
        actor,
    );
    app.usageIngestEndpointEnvironmentId = usageEndpointEnvironment.id;
    app = await repoFactory(App).save(app, actor, OperationOwner.USER);

    //create first revision...
    let revision = new Revision('Revision 1', app);
    if (appRevisionId !== undefined) {
        revision['_id'] = appRevisionId;
    }
    revision = await repoFactory(Revision).save(revision, actor, OperationOwner.USER, {
        gqlMethod: GQLMethod.CREATE,
        userComments: 'Auto-generated the first revision for the App',
        forceCreate: appRevisionId !== undefined,
    });

    //create a global trigger...
    await createGlobalTrigger(actor, 'Global Trigger 1', revision);

    //create a global action distribution...
    await createActionGroupDistribution(
        actor,
        revision,
        'Global Action Group Distribution 1',
        ActionGroupDistributionType.NONE,
    );

    //create a head tag...
    const headTag = await createTagSkeleton(
        actor,
        revision,
        'Main Tag',
        TagType.HEAD,
        undefined,
        undefined,
        true,
    );

    //link tag back to revision
    revision.tagIds = [headTag.id];
    //connect the new revision with latest version of our core...
    const latestCorePlatformRevision = await repoFactory(PlatformRevision).findOneThrows(
        {
            _platform_id: corePlatform.id,
            _is_published: true,
        },
        userMessages.revisionFailed,
        { _id: SortDirection.DESC }, //mongo clock is not good enough on iso date, need to use id
    );
    revision.appPlatformRevisionIds = [
        (
            await repoFactory(AppPlatformRevision).save(
                new AppPlatformRevision(revision, latestCorePlatformRevision),
                actor,
                OperationOwner.USER,
                {
                    gqlMethod: GQLMethod.CREATE,
                    userComments:
                        'Automatically linked the latest version of Scale8 core library to the first revision',
                },
            )
        ).id,
    ];
    revision.isFinal = true;
    await repoFactory(Revision).save(revision, actor, OperationOwner.USER, {
        gqlMethod: GQLMethod.FINALIZE_REVISION,
        userComments:
            'Automatically linking tags, core platform and finalizing the first revision so it can be attached to an environment and installed',
    });

    await createEnvironment(
        actor,
        app,
        'Production',
        revision,
        typeof appEnvironmentUrl === 'string' ? appEnvironmentUrl : `https://${domain}`,
        undefined,
        undefined,
        undefined,
        [],
        appEnvironmentId,
    );

    //finally clone first revision ready for editing...
    const newRevision = await duplicateRevision(actor, revision);
    newRevision.name = 'Revision 2';
    await repoFactory(Revision).save(newRevision, actor, OperationOwner.USER, {
        gqlMethod: GQLMethod.CREATE,
        userComments: 'Automatically cloned the first revision to enable editing',
    });

    return app;
};
