import { FC } from 'react';
import { SvgIconProps } from '@material-ui/core';
import CodeIcon from '@material-ui/icons/Code';

const CodeTypeIcon: FC<SvgIconProps> = (props: SvgIconProps) => {
    return (
        <>
            <CodeIcon {...props} />
        </>
    );
};

export default CodeTypeIcon;
