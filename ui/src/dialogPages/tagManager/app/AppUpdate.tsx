import { FC } from 'react';
import { FormValidationResult } from '../../../hooks/form/useFormValidation';
import { ApolloError, useMutation, useQuery } from '@apollo/client';
import UpdateAppGetQuery from '../../../gql/queries/UpdateAppGetQuery';
import { UpdateAppGetData } from '../../../gql/generated/UpdateAppGetData';
import UpdateAppQuery from '../../../gql/mutations/UpdateAppQuery';
import AppForm from '../../../components/organisms/Forms/AppForm';
import { AppFormProps, AppValues } from './AppCreate';
import nameValidator from '../../../utils/validators/nameValidator';
import domainValidator from '../../../utils/validators/domainValidator';
import { UpdateApp } from '../../../gql/generated/UpdateApp';
import { DialogPageProps } from '../../../types/DialogTypes';
import { DialogPreloadForm, DialogPreloadFormProps } from '../../abstractions/DialogPreloadForm';
import { buildStandardFormInfo } from '../../../utils/InfoLabelsUtils';

const AppUpdate: FC<DialogPageProps> = (props: DialogPageProps) => {
    const appUpdaterProps: DialogPreloadFormProps<
        UpdateAppGetData,
        AppValues,
        AppFormProps,
        UpdateApp
    > = {
        loadQuery: useQuery<UpdateAppGetData>(UpdateAppGetQuery, {
            variables: { id: props.id },
        }),
        buildInitialStatePreload: (formLoadedData: UpdateAppGetData) => ({
            name: formLoadedData.getApp.name,
            domain: formLoadedData.getApp.domain,
            type: formLoadedData.getApp.type,
        }),
        saveQuery: useMutation(UpdateAppQuery),
        mapSaveData: (appValues: AppValues) => ({
            appUpdateInput: {
                app_id: props.id,
                name: appValues.name,
                domain: appValues.domain,
            },
        }),
        buildFormProps: (
            formLoadedData: UpdateAppGetData,
            formValidationValues: FormValidationResult<AppValues>,
            gqlError?: ApolloError,
        ) => ({
            ...formValidationValues,
            gqlError,
            submitText: 'Update Application',
            title: 'Update Application',
            formInfoProps: buildStandardFormInfo('applications', 'Update'),
            handleDialogClose: props.handleDialogClose,
            useDomainName: formLoadedData.getApp.name === formLoadedData.getApp.domain,
            isCreate: false,
        }),
        checkSuccessfullySubmitted: (formMutationData) => formMutationData?.updateApp,
        pageComponent: AppForm,
        validators: [
            {
                field: 'name',
                validator: nameValidator,
                error: () => 'Application name too short',
            },
            {
                field: 'domain',
                validator: domainValidator,
                error: () => 'Invalid domain',
            },
        ],
        ...props,
    };

    return (
        <DialogPreloadForm<UpdateAppGetData, AppValues, AppFormProps, UpdateApp>
            {...appUpdaterProps}
        />
    );
};

export { AppUpdate };
