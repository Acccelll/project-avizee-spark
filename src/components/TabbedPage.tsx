import React from 'react';

const TabbedPage = () => {
    const [activeTab, setActiveTab] = React.useState(0);
    const tabs = ['Tab 1', 'Tab 2', 'Tab 3'];

    return (
        <div>
            <div className="tabs">
                {tabs.map((tab, index) => (
                    <button key={index} onClick={() => setActiveTab(index)}>
                        {tab}
                    </button>
                ))}
            </div>
            <div className="tab-content">
                {activeTab === 0 && <div>Content for Tab 1</div>}
                {activeTab === 1 && <div>Content for Tab 2</div>}
                {activeTab === 2 && <div>Content for Tab 3</div>}
            </div>
        </div>
    );
};

export default TabbedPage;