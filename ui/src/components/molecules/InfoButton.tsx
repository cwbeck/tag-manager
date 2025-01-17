import { FC, MouseEvent, useState } from 'react';
import { createStyles, IconButton, Popover, Theme } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import Markdown from 'markdown-to-jsx';
import HelpIcon from '@material-ui/icons/Help';
import { getInfo } from '../../info/getInfo';
import { navigationColorFromSectionLocator } from '../../containers/SectionsDetails';
import { standardMarkdownOptions } from '../../utils/MarkdownUtils';
import { getDocUrl } from '../../utils/ConfigUtils';
import { useLoggedInState } from '../../context/AppContext';

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        infoContent: {
            backgroundColor: '#f5f5f5',
            width: '400px',
            maxHeight: '300px',
            overflow: 'auto',
            padding: theme.spacing(2, 2, 0),
            '& p': {
                margin: theme.spacing(0, 0, 2, 0),
                display: 'inline-block',
            },
            '& a': {
                color: 'inherit',
                textDecoration: 'underline',
            },
        },
    }),
);

export type InfoProps = {
    side: 'left' | 'right';
    id: string;
};

const InfoButton: FC<InfoProps> = (props: InfoProps) => {
    const { templateInteractions } = useLoggedInState();
    const { sectionHistory } = templateInteractions;
    const navigationColor = navigationColorFromSectionLocator(sectionHistory.current);

    const classes = useStyles();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    if (getInfo(props.id) === '') {
        return null;
    }

    return (
        <>
            <IconButton
                size="small"
                disableRipple
                style={{
                    color: navigationColor,
                    background: 'transparent',
                }}
                onClick={handleClick}
            >
                <HelpIcon style={{ fontSize: 15 }} />
            </IconButton>
            <Popover
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: props.side === 'right' ? 'right' : 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: props.side === 'right' ? 'left' : 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                anchorEl={anchorEl}
            >
                <div className={classes.infoContent}>
                    <Markdown options={standardMarkdownOptions}>
                        {getInfo(props.id).replace('{{DOCUMENTATION_URL}}', getDocUrl())}
                    </Markdown>
                </div>
            </Popover>
        </>
    );
};

export { InfoButton };
